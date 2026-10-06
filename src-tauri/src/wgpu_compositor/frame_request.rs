/// A request to the scheduler to produce a frame at a given timestamp.
///
/// # Design
///
/// `FrameRequest` contains NO `target: RenderTargetId`. Frame production and
/// frame presentation are separate concerns:
///
/// - `FrameRequest` answers: "What frame must exist?"
/// - `PresentationRequest` answers: "Where does that frame go?"
///
/// This separation enforces Principle 1:
/// > Decode once → materialize a reusable GPU FrameResource →
/// > render into any number of presentation targets.
///
/// With three active monitors and one `FrameRequest`, a single decoded
/// `FrameResource` is shared across all three targets — no duplicate decode.
#[derive(Debug, Clone)]
pub struct FrameRequest {
    /// Presentation timestamp in the clip's timebase.
    pub timestamp: std::time::Duration,
    /// Scheduling priority. Drives queue placement and drop eligibility.
    pub priority: FramePriority,
    /// Quality constraints for this request.
    pub quality: PreviewQuality,
    /// If true, the nearest keyframe is acceptable (fast scrub mode).
    /// If false, the frame must be exact (seek, frame-step, export).
    pub allow_keyframe_approx: bool,
}

/// Scheduling priority tier.
///
/// Ordered: `Realtime > Interactive > Background`.
/// The scheduler uses this to decide queue placement and which frames to drop
/// under pressure.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FramePriority {
    /// Lowest: thumbnail generation, lookahead prefetch.
    /// Opportunistically processed; first to be dropped under load.
    Background = 0,
    /// Middle: scrub, seek, frame-step.
    /// No frame drop permitted. Processed before Background.
    Interactive = 1,
    /// Highest: active playback presentation.
    /// Frame drop is allowed when GPU/CPU cannot keep up.
    Realtime = 2,
}

/// Quality tier for a frame request.
///
/// Drives resolution scale and decode parameters. Adaptive selection lives
/// in Phase 5 (`PerformanceManager`). Phase 3 defines the vocabulary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum PreviewQuality {
    /// 0.25× resolution. Emergency mode / thumbnail generation.
    Quarter = 0,
    /// 0.5× resolution. Fast scrub — acceptable visual degradation for speed.
    Half = 1,
    /// 1.0× resolution. Normal playback and paused preview.
    Full = 2,
}

impl PreviewQuality {
    /// Resolution scale factor as f32.
    pub fn scale_factor(&self) -> f32 {
        match self {
            Self::Quarter => 0.25,
            Self::Half => 0.5,
            Self::Full => 1.0,
        }
    }
}

// ---------------------------------------------------------------------------
// PresentationRequest — separate from frame production
// ---------------------------------------------------------------------------

/// Routes an already-materialized `FrameResource` to a specific render target.
///
/// Produced by the scheduler or the direct-render path after a `FrameResource`
/// has been decoded. The render engine consumes this alongside the resource.
///
/// # Relationship to `FrameRequest`
///
/// ```text
/// FrameRequest  ──►  Scheduler  ──►  FrameResource
///                                          │
///                                          ▼ (one per active target)
///                                   PresentationRequest
///                                          │
///                                          ▼
///                                     RenderTarget
/// ```
#[derive(Debug, Clone)]
pub struct PresentationRequest {
    /// Sequence number linking this request to the decoded `FrameResource`.
    pub frame_sequence: u64,
    /// Which render target to present into.
    pub target: crate::commands::render_target_manager::RenderTargetId,
    /// Optional viewport override. `None` = fill the entire target.
    pub viewport: Option<Viewport>,
}

/// A sub-region of a render target to present into (letterbox / pillarbox).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Viewport {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_priority_ordering() {
        // Principle 2: Realtime > Interactive > Background.
        assert!(FramePriority::Realtime > FramePriority::Interactive);
        assert!(FramePriority::Interactive > FramePriority::Background);
        assert!(FramePriority::Realtime > FramePriority::Background);
    }

    #[test]
    fn preview_quality_ordering() {
        assert!(PreviewQuality::Full > PreviewQuality::Half);
        assert!(PreviewQuality::Half > PreviewQuality::Quarter);
    }

    #[test]
    fn preview_quality_scale_factors() {
        assert!((PreviewQuality::Full.scale_factor() - 1.0).abs() < f32::EPSILON);
        assert!((PreviewQuality::Half.scale_factor() - 0.5).abs() < f32::EPSILON);
        assert!((PreviewQuality::Quarter.scale_factor() - 0.25).abs() < f32::EPSILON);
    }

    #[test]
    fn frame_request_no_target_id() {
        // FrameRequest must not carry a RenderTargetId.
        // This is verified structurally by the fact that the struct definition
        // compiles without one. The test below documents the design decision.
        let req = FrameRequest {
            timestamp: std::time::Duration::from_secs(10),
            priority: FramePriority::Realtime,
            quality: PreviewQuality::Full,
            allow_keyframe_approx: false,
        };
        assert_eq!(req.priority, FramePriority::Realtime);
        // No `req.target` field — separation of production from presentation.
    }

    #[test]
    fn viewport_fields() {
        let vp = Viewport {
            x: 0,
            y: 100,
            width: 1920,
            height: 800,
        };
        assert_eq!(vp.height, 800);
    }
}
