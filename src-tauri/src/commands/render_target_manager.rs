//! Presentation target lifecycle management.
//!
//! # Design
//!
//! [`RenderTargetManager`] is **boring by design**. Its only job is:
//! create, destroy, resize, show, hide, and hand out presentation handles.
//! It does **not** render.
//!
//! Rendering flows as:
//! ```text
//! renderer.render(&frame_resource, &mut present_frame)?;
//! present_frame.present();
//! ```
//! Not `target.render(frame)`.
//!
//! # Target vs Monitor
//!
//! - [`RenderTargetId`] = Clypra's logical output. An opaque `u64`.
//! - [`MonitorId`]      = OS display device (HMONITOR / CGDirectDisplayID).
//!
//! These are separate concepts. A logical target can survive monitor
//! disconnection in a [`RenderTargetState::surface_lost`] state. When the
//! monitor reappears, the target reattaches.

use crate::wgpu_compositor::GpuContext;
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tauri::{AppHandle, Manager, PhysicalSize, Window};

// ---------------------------------------------------------------------------
// RenderTargetId — opaque, not semantic
// ---------------------------------------------------------------------------

static NEXT_TARGET_ID: AtomicU64 = AtomicU64::new(10); // 0-9 reserved for named constants

/// Opaque presentation destination identifier.
///
/// Semantic names are in the *calling code*, not encoded here. Named constants
/// (PROGRAM, SOURCE, EXTERNAL) are provided for convenience; they are just `u64`s.
///
/// Use [`RenderTargetId::new_unique()`] for dynamic targets (scopes, thumbnails).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RenderTargetId(u64);

impl RenderTargetId {
    /// The primary program monitor output.
    pub const PROGRAM: Self = Self(0);
    /// The source (clip) monitor output.
    pub const SOURCE: Self = Self(1);
    /// The external HDMI / display-port monitor output.
    pub const EXTERNAL: Self = Self(2);

    /// Allocate a new unique ID for a dynamic target (scope, thumbnail, etc.).
    pub fn new_unique() -> Self {
        Self(NEXT_TARGET_ID.fetch_add(1, Ordering::Relaxed))
    }

    pub fn raw(&self) -> u64 {
        self.0
    }
}

impl Default for RenderTargetId {
    fn default() -> Self {
        Self::PROGRAM
    }
}

impl std::fmt::Display for RenderTargetId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            Self::PROGRAM => write!(f, "Program"),
            Self::SOURCE => write!(f, "Source"),
            Self::EXTERNAL => write!(f, "External"),
            Self(n) => write!(f, "Target({n})"),
        }
    }
}

// ---------------------------------------------------------------------------
// RenderTargetKind — semantic metadata only
// ---------------------------------------------------------------------------

/// What kind of monitor or output this target represents.
///
/// Semantic annotation only — does not drive rendering behaviour.
/// The render engine uses [`RenderTargetId`], not this enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderTargetKind {
    ProgramMonitor,
    SourceMonitor,
    ExternalMonitor,
    Scope,
    Offscreen,
}

// ---------------------------------------------------------------------------
// MonitorId — OS display device (separate from RenderTargetId)
// ---------------------------------------------------------------------------

/// OS-level display device identifier.
///
/// Sourced from Tauri's monitor API. Separate from [`RenderTargetId`]
/// because a logical output can outlive the display it was last shown on.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MonitorId(pub String);

// ---------------------------------------------------------------------------
// PresentationTarget — where frames actually go
// ---------------------------------------------------------------------------

/// The underlying presentation mechanism for a render target.
#[allow(clippy::large_enum_variant)]
pub enum PresentationTarget {
    /// Native OS window (HWND on Windows, NSView on macOS).
    NativeWindow {
        surface: wgpu::Surface<'static>,
        window: Window,
    },
    /// Off-screen texture (export, thumbnail, test, scopes).
    Texture { texture: Arc<wgpu::Texture> },
}

impl std::fmt::Debug for PresentationTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NativeWindow { .. } => write!(f, "NativeWindow"),
            Self::Texture { .. } => write!(f, "OffscreenTexture"),
        }
    }
}

// ---------------------------------------------------------------------------
// RenderTargetState — presentation lifecycle
// ---------------------------------------------------------------------------

/// Dynamic health and presentation state for one render target.
///
/// Owns the state needed to handle external monitor unplug, window
/// minimisation, and surface loss mid-playback without crashing.
#[derive(Debug, Default)]
pub struct RenderTargetState {
    pub visible: bool,
    pub minimized: bool,
    /// `true` when the window/surface has been resized but `acquire_for_present`
    /// has not yet reconfigured the swapchain.
    pub needs_resize: bool,
    /// `true` when the wgpu surface is lost (monitor unplugged, device reset).
    /// `acquire_for_present` will attempt recovery; if it fails the frame is
    /// skipped rather than crashing.
    pub surface_lost: bool,
    /// The sequence number of the last successfully presented frame.
    pub last_presented_sequence: Option<u64>,
    /// Which OS monitor this target is currently on. `None` = unknown / headless.
    pub monitor_id: Option<MonitorId>,
}

// ---------------------------------------------------------------------------
// RenderTarget — a single presentation destination
// ---------------------------------------------------------------------------

/// A single presentation destination.
///
/// Does NOT contain rendering logic. The render engine writes a `FrameResource`
/// into a [`PresentFrame`] acquired from this target, then calls
/// `PresentFrame::present()`.
pub struct RenderTarget {
    pub id: RenderTargetId,
    pub kind: RenderTargetKind,
    pub size: PhysicalSize<u32>,
    pub surface_format: wgpu::TextureFormat,
    pub state: RenderTargetState,
    presentation: PresentationTarget,
    configuration: Option<wgpu::SurfaceConfiguration>,
}

impl std::fmt::Debug for RenderTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RenderTarget")
            .field("id", &self.id)
            .field("kind", &self.kind)
            .field("size", &(self.size.width, self.size.height))
            .field("presentation", &self.presentation)
            .field("state", &self.state)
            .finish_non_exhaustive()
    }
}

// ---------------------------------------------------------------------------
// PresentFrame — abstraction over SurfaceTexture
// ---------------------------------------------------------------------------

/// Acquired from [`RenderTargetManager::acquire_for_present`].
///
/// The renderer writes into [`PresentFrame::view`], then calls
/// [`PresentFrame::present()`]. `wgpu::SurfaceTexture` is never exposed
/// outside this module — `PresentFrame` is the abstraction boundary.
///
/// When [`PresentationTarget::Texture`] (offscreen) support is added, the
/// renderer call site remains unchanged: it always receives a `PresentFrame`.
pub struct PresentFrame {
    pub target_id: RenderTargetId,
    /// Texture view to render into.
    pub view: wgpu::TextureView,
    /// Logical size of the target in pixels.
    pub size: PhysicalSize<u32>,
    /// Surface format (for render pass colour attachment).
    pub format: wgpu::TextureFormat,
    inner: PresentFrameInner,
}

#[allow(dead_code)]
enum PresentFrameInner {
    Surface(wgpu::SurfaceTexture),
    Offscreen, // future: Arc<wgpu::Texture>
}

impl PresentFrame {
    /// Consume this frame and present it to the OS compositor / swapchain.
    pub fn present(self) {
        match self.inner {
            PresentFrameInner::Surface(st) => st.present(),
            PresentFrameInner::Offscreen => { /* off-screen targets need explicit readback */ }
        }
    }
}

// ---------------------------------------------------------------------------
// RenderTargetManager
// ---------------------------------------------------------------------------

/// Manages the set of active presentation targets.
///
/// Creating, destroying, resizing, showing, hiding, and handing out
/// presentation handles is its entire remit.
pub struct RenderTargetManager {
    targets: HashMap<RenderTargetId, RenderTarget>,
    gpu: Arc<GpuContext>,
}

impl RenderTargetManager {
    pub fn new(gpu: Arc<GpuContext>) -> Self {
        Self {
            targets: HashMap::new(),
            gpu,
        }
    }

    // -----------------------------------------------------------------------
    // Target lifecycle
    // -----------------------------------------------------------------------

    /// Get an existing target or create a new native-window target.
    ///
    /// The created window is a native child window (no WebView2 backing),
    /// transparent, decoration-free, and parented to the app's main window.
    pub fn get_or_create_target(
        &mut self,
        id: RenderTargetId,
        kind: RenderTargetKind,
        size: PhysicalSize<u32>,
        app: &AppHandle,
    ) -> Result<&mut RenderTarget, String> {
        if !self.targets.contains_key(&id) {
            let target = Self::create_native_target(id, kind, size, app, &self.gpu)?;
            self.targets.insert(id, target);
        }
        Ok(self.targets.get_mut(&id).unwrap())
    }

    /// Permanently destroy a target and release its window + surface.
    pub fn destroy_target(&mut self, id: &RenderTargetId) {
        if let Some(target) = self.targets.remove(id) {
            Self::close_presentation(target.presentation);
        }
    }

    /// Resize a target. Sets `state.needs_resize = true`; the swapchain is
    /// reconfigured lazily on the next `acquire_for_present` call so the
    /// manager does not block the calling thread waiting for the GPU.
    pub fn resize_target(
        &mut self,
        id: &RenderTargetId,
        size: PhysicalSize<u32>,
    ) -> Result<(), String> {
        let target = self
            .targets
            .get_mut(id)
            .ok_or_else(|| format!("RenderTarget {id} not found"))?;
        target.size = size;
        target.state.needs_resize = true;
        if let Some(cfg) = target.configuration.as_mut() {
            cfg.width = size.width.max(1);
            cfg.height = size.height.max(1);
        }
        Ok(())
    }

    /// Show a target window.
    pub fn show_target(&mut self, id: &RenderTargetId) -> Result<(), String> {
        let target = self
            .targets
            .get_mut(id)
            .ok_or_else(|| format!("RenderTarget {id} not found"))?;
        if let PresentationTarget::NativeWindow { window, .. } = &target.presentation {
            window
                .show()
                .map_err(|e| format!("show_target {id}: {e}"))?;
        }
        target.state.visible = true;
        Ok(())
    }

    /// Hide a target window.
    pub fn hide_target(&mut self, id: &RenderTargetId) -> Result<(), String> {
        let target = self
            .targets
            .get_mut(id)
            .ok_or_else(|| format!("RenderTarget {id} not found"))?;
        if let PresentationTarget::NativeWindow { window, .. } = &target.presentation {
            window
                .hide()
                .map_err(|e| format!("hide_target {id}: {e}"))?;
        }
        target.state.visible = false;
        Ok(())
    }

    /// Reset a single target's presentation state (sequence counter, surface
    /// config, visible flag). Does not destroy or recreate the window.
    pub fn reset_target(&mut self, id: &RenderTargetId) {
        if let Some(target) = self.targets.get_mut(id) {
            target.state.last_presented_sequence = None;
            target.state.needs_resize = false;
            target.state.surface_lost = false;
            let _ = self.hide_target(id);
        }
    }

    /// Reset all targets (on project close or GPU device reset).
    pub fn reset_all(&mut self) {
        let ids: Vec<_> = self.targets.keys().copied().collect();
        for id in ids {
            self.reset_target(&id);
        }
    }

    // -----------------------------------------------------------------------
    // Presentation
    // -----------------------------------------------------------------------

    /// Returns an iterator over IDs of targets that are active (visible,
    /// not minimized, not surface-lost).
    pub fn active_targets(&self) -> impl Iterator<Item = RenderTargetId> + '_ {
        self.targets.iter().filter_map(|(id, t)| {
            if t.state.visible && !t.state.minimized && !t.state.surface_lost {
                Some(*id)
            } else {
                None
            }
        })
    }

    /// Acquire a [`PresentFrame`] for rendering into `id`.
    ///
    /// Reconfigures the swapchain if `state.needs_resize` is set.
    /// Returns `Err` if the surface is lost and recovery fails — the caller
    /// should skip this frame and try again next tick.
    pub fn acquire_for_present(&mut self, id: &RenderTargetId) -> Result<PresentFrame, String> {
        let target = self
            .targets
            .get_mut(id)
            .ok_or_else(|| format!("RenderTarget {id} not found"))?;

        match &mut target.presentation {
            PresentationTarget::NativeWindow { surface, .. } => {
                // Reconfigure if dimensions changed.
                if target.state.needs_resize {
                    if let Some(cfg) = &target.configuration {
                        surface.configure(&self.gpu.device, cfg);
                    }
                    target.state.needs_resize = false;
                    target.state.surface_lost = false;
                }

                let surface_texture = match surface.get_current_texture() {
                    Ok(st) => st,
                    Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                        // Attempt one recovery reconfigure.
                        if let Some(cfg) = &target.configuration {
                            surface.configure(&self.gpu.device, cfg);
                        }
                        surface
                            .get_current_texture()
                            .map_err(|e| format!("Surface recovery failed for {id}: {e}"))?
                    }
                    Err(wgpu::SurfaceError::Timeout) => {
                        return Err(format!("Surface timeout for {id}"))
                    }
                    Err(e) => return Err(format!("Surface error for {id}: {e}")),
                };

                target.state.surface_lost = false;

                let view = surface_texture
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default());

                Ok(PresentFrame {
                    target_id: *id,
                    view,
                    size: target.size,
                    format: target.surface_format,
                    inner: PresentFrameInner::Surface(surface_texture),
                })
            }

            PresentationTarget::Texture { .. } => Err(format!(
                "Offscreen texture presentation not yet implemented for {id}"
            )),
        }
    }

    // -----------------------------------------------------------------------
    // Monitor association
    // -----------------------------------------------------------------------

    /// Called by the OS monitor listener when the display a target is on changes.
    pub fn on_monitor_changed(&mut self, id: &RenderTargetId, monitor: Option<MonitorId>) {
        if let Some(target) = self.targets.get_mut(id) {
            target.state.monitor_id = monitor;
        }
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn create_native_target(
        id: RenderTargetId,
        kind: RenderTargetKind,
        size: PhysicalSize<u32>,
        app: &AppHandle,
        gpu: &GpuContext,
    ) -> Result<RenderTarget, String> {
        use tauri::window::WindowBuilder;

        let label = format!("render-target-{}", id.raw());

        let parent = app.get_window("main").ok_or("Main window not found")?;

        let window = WindowBuilder::new(app, &label)
            .parent(&parent)
            .map_err(|e| format!("WindowBuilder::parent failed: {e}"))?
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .skip_taskbar(true)
            .focusable(false)
            .visible(false)
            .resizable(false)
            .inner_size(size.width as f64, size.height as f64)
            .build()
            .map_err(|e| format!("WindowBuilder::build failed for {id}: {e}"))?;

        window
            .set_ignore_cursor_events(true)
            .map_err(|e| format!("set_ignore_cursor_events failed: {e}"))?;

        // macOS: float above full-screen spaces and follow active Space.
        #[cfg(target_os = "macos")]
        unsafe {
            if let Ok(ns_win) = window.ns_window() {
                // NSWindowCollectionBehaviorFullScreenAuxiliary (1 << 8) | NSWindowCollectionBehaviorMoveToActiveSpace (1 << 1)
                let behavior: usize = (1 << 8) | (1 << 1);
                let current_behavior: usize =
                    objc2::msg_send![ns_win as *mut objc2::runtime::AnyObject, collectionBehavior];
                let _: () = objc2::msg_send![
                    ns_win as *mut objc2::runtime::AnyObject,
                    setCollectionBehavior: current_behavior | behavior
                ];
            }
        }

        // Create wgpu surface on the native HWND / NSView.
        let surface = gpu
            .instance
            .create_surface(window.clone())
            .map_err(|e| format!("create_surface failed for {id}: {e}"))?;

        // Select surface format.
        let capabilities = surface.get_capabilities(&gpu.adapter);
        let surface_format = capabilities
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or_else(|| capabilities.formats[0]);

        let configuration = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width.max(1),
            height: size.height.max(1),
            present_mode: wgpu::PresentMode::AutoVsync,
            desired_maximum_frame_latency: 2,
            alpha_mode: capabilities
                .alpha_modes
                .first()
                .copied()
                .unwrap_or(wgpu::CompositeAlphaMode::Auto),
            view_formats: vec![],
        };

        surface.configure(&gpu.device, &configuration);

        Ok(RenderTarget {
            id,
            kind,
            size,
            surface_format,
            state: RenderTargetState {
                visible: false,
                ..Default::default()
            },
            presentation: PresentationTarget::NativeWindow { surface, window },
            configuration: Some(configuration),
        })
    }

    fn close_presentation(presentation: PresentationTarget) {
        if let PresentationTarget::NativeWindow { window, .. } = presentation {
            let _ = window.hide();
            let _ = window.close();
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_target_id_named_constants_are_distinct() {
        assert_ne!(RenderTargetId::PROGRAM, RenderTargetId::SOURCE);
        assert_ne!(RenderTargetId::SOURCE, RenderTargetId::EXTERNAL);
        assert_ne!(RenderTargetId::PROGRAM, RenderTargetId::EXTERNAL);
    }

    #[test]
    fn render_target_id_new_unique_does_not_collide_with_constants() {
        let id = RenderTargetId::new_unique();
        assert_ne!(id, RenderTargetId::PROGRAM);
        assert_ne!(id, RenderTargetId::SOURCE);
        assert_ne!(id, RenderTargetId::EXTERNAL);
    }

    #[test]
    fn render_target_id_sequential_unique_ids_differ() {
        let a = RenderTargetId::new_unique();
        let b = RenderTargetId::new_unique();
        assert_ne!(a, b);
    }

    #[test]
    fn render_target_id_display() {
        assert_eq!(format!("{}", RenderTargetId::PROGRAM), "Program");
        assert_eq!(format!("{}", RenderTargetId::SOURCE), "Source");
        assert_eq!(format!("{}", RenderTargetId::EXTERNAL), "External");
        assert_eq!(format!("{}", RenderTargetId(42)), "Target(42)");
    }

    #[test]
    fn frame_priority_ordering() {
        use crate::wgpu_compositor::frame_request::FramePriority;
        assert!(FramePriority::Realtime > FramePriority::Interactive);
        assert!(FramePriority::Interactive > FramePriority::Background);
    }

    #[test]
    fn monitor_id_equality() {
        let a = MonitorId(r"\\.\DISPLAY1".to_string());
        let b = MonitorId(r"\\.\DISPLAY1".to_string());
        let c = MonitorId(r"\\.\DISPLAY2".to_string());
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
