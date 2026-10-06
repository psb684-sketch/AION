use crate::wgpu_compositor::render_path::FrameSource;
use std::sync::Arc;
use wgpu::util::DeviceExt;

/// Pixel format of a GPU-resident video frame.
///
/// Named `VideoPixelFormat` (not `FramePixelFormat`) because future
/// variants include Rgba16F, Bgra8, YUV444 — not exclusively "frame" formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoPixelFormat {
    /// 8-bit 4:2:0 biplanar (NV12). Standard SDR decode output.
    Nv12,
    /// 10-bit 4:2:0 biplanar (P010). HDR10 decode output.
    P010,
    /// 8-bit RGBA. Composited output or compatibility fallback.
    Rgba8,
    /// 16-bit float RGBA. HDR pipeline / wide-gamut compositing.
    Rgba16F,
}

impl VideoPixelFormat {
    /// Returns the wgpu texture format used for this pixel format's primary plane.
    pub fn wgpu_format(&self) -> wgpu::TextureFormat {
        match self {
            Self::Nv12 => wgpu::TextureFormat::NV12,
            Self::P010 => wgpu::TextureFormat::NV12, // P010 uses same wgpu type; plane format differs
            Self::Rgba8 => wgpu::TextureFormat::Rgba8Unorm,
            Self::Rgba16F => wgpu::TextureFormat::Rgba16Float,
        }
    }
}

// ---------------------------------------------------------------------------
// Color metadata
// ---------------------------------------------------------------------------

/// Color primaries per ISO 23001-8 / H.273.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ColorPrimaries {
    #[default]
    Bt709,
    Bt2020,
    Srgb,
    Unspecified,
}

/// Electro-optical transfer function.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TransferFunction {
    #[default]
    Bt709,
    Pq,  // PQ / ST.2084 — HDR10
    Hlg, // Hybrid Log-Gamma
    Linear,
    Srgb,
    Unspecified,
}

/// YCbCr matrix coefficients.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ColorMatrix {
    #[default]
    Bt709,
    Bt601,
    Bt2020NonConstant,
    Identity, // for RGB sources
    Unspecified,
}

/// Signal range: limited (studio swing) vs full range.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ColorRange {
    /// Limited: Y 16–235, CbCr 16–240.
    #[default]
    Limited,
    /// Full: Y 0–255, CbCr 0–255.
    Full,
}

/// Complete color metadata for a video frame.
///
/// Carried through the full pipeline:
/// `Decode → FrameSource → FrameResource → RenderGraph`
///
/// This makes HDR a render-graph concern, not a decoder special case.
///
/// `Default` = BT.709 limited (safe SDR fallback).
#[derive(Debug, Clone, PartialEq)]
pub struct FrameColorInfo {
    pub primaries: ColorPrimaries,
    pub transfer_function: TransferFunction,
    pub matrix: ColorMatrix,
    pub range: ColorRange,
}

impl Default for FrameColorInfo {
    fn default() -> Self {
        Self {
            primaries: ColorPrimaries::Bt709,
            transfer_function: TransferFunction::Bt709,
            matrix: ColorMatrix::Bt709,
            range: ColorRange::Limited,
        }
    }
}

impl FrameColorInfo {
    /// Construct HDR10 (BT.2020 / PQ / limited) color info.
    pub fn hdr10() -> Self {
        Self {
            primaries: ColorPrimaries::Bt2020,
            transfer_function: TransferFunction::Pq,
            matrix: ColorMatrix::Bt2020NonConstant,
            range: ColorRange::Limited,
        }
    }

    /// Returns true if this frame requires an HDR render path.
    pub fn is_hdr(&self) -> bool {
        matches!(
            self.transfer_function,
            TransferFunction::Pq | TransferFunction::Hlg
        )
    }
}

// ---------------------------------------------------------------------------
// FrameResource — the decode → render boundary
// ---------------------------------------------------------------------------

/// A GPU-resident video frame ready for rendering.
///
/// # Design
///
/// - Produced by the DXGI zero-copy importer (Windows DX12 + D3D11VA) or by
///   [`FrameUploader::upload`] (CPU path, all platforms).
/// - Consumed by `RenderEngine::render`. The render engine never branches on
///   how the resource was produced.
/// - `texture` is **private**. Access via [`FrameResource::texture()`]. This
///   hides the internal storage model, allowing future changes (multi-plane,
///   texture arrays, external textures) without changing render-engine call sites.
///
/// # Invariant
///
/// A `FrameResource` always contains valid GPU data. Failure to produce one
/// returns `Err(PreviewRenderError)` — never `Ok(resource_with_black_pixels)`.
pub struct FrameResource {
    /// GPU texture. Private: access via `texture()`.
    texture: Arc<wgpu::Texture>,
    /// Pixel format of the GPU texture.
    pub format: VideoPixelFormat,
    /// Logical frame dimensions in pixels.
    pub size: wgpu::Extent3d,
    /// Color metadata. Always populated; defaults to BT.709 limited.
    pub color_info: FrameColorInfo,
    /// How this resource was produced.
    pub provenance: FrameSource,
    /// Monotonic sequence number from the decode pipeline.
    pub sequence: u64,
}

impl FrameResource {
    /// The GPU texture backing this frame.
    ///
    /// Hides internal storage model from the render engine.
    pub fn texture(&self) -> &wgpu::Texture {
        &self.texture
    }

    /// Shared Arc to the GPU texture, for bind-group creation where the
    /// texture must outlive the pass builder.
    pub fn texture_arc(&self) -> Arc<wgpu::Texture> {
        Arc::clone(&self.texture)
    }

    /// Width in pixels.
    pub fn width(&self) -> u32 {
        self.size.width
    }

    /// Height in pixels.
    pub fn height(&self) -> u32 {
        self.size.height
    }

    /// Construct from an already-created wgpu texture.
    ///
    /// Used by the DXGI importer which wraps the D3D11VA texture directly.
    /// Not for general use: callers should go through `FrameUploader` or the
    /// DXGI importer.
    #[allow(dead_code)]
    pub(crate) fn from_texture(
        texture: Arc<wgpu::Texture>,
        format: VideoPixelFormat,
        size: wgpu::Extent3d,
        color_info: FrameColorInfo,
        provenance: FrameSource,
        sequence: u64,
    ) -> Self {
        Self {
            texture,
            format,
            size,
            color_info,
            provenance,
            sequence,
        }
    }
}

impl std::fmt::Debug for FrameResource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FrameResource")
            .field("format", &self.format)
            .field("size", &(self.size.width, self.size.height))
            .field("color_info", &self.color_info)
            .field("provenance", &self.provenance)
            .field("sequence", &self.sequence)
            .finish_non_exhaustive()
    }
}

// ---------------------------------------------------------------------------
// CPU upload path
// ---------------------------------------------------------------------------

/// Raw CPU-decoded video frame ready for GPU upload.
pub struct CpuFrame<'a> {
    pub y_plane: &'a [u8],
    pub uv_plane: &'a [u8],
    pub width: u32,
    pub height: u32,
    pub format: VideoPixelFormat,
    pub color_info: FrameColorInfo,
    pub sequence: u64,
}

/// Uploads CPU-decoded video frames to GPU textures, producing `FrameResource`.
///
/// This is the all-platform path. On Windows DX12 with D3D11VA, prefer the
/// DXGI zero-copy importer and fall back to this on failure.
pub struct FrameUploader;

impl FrameUploader {
    /// Upload a CPU-decoded NV12 frame to a new GPU texture.
    pub fn upload(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        frame: &CpuFrame<'_>,
    ) -> Result<FrameResource, String> {
        let size = wgpu::Extent3d {
            width: frame.width,
            height: frame.height,
            depth_or_array_layers: 1,
        };

        let wgpu_format = frame.format.wgpu_format();

        // NV12: Y-plane rows followed by interleaved UV rows.
        let mut data = Vec::with_capacity(frame.y_plane.len() + frame.uv_plane.len());
        data.extend_from_slice(frame.y_plane);
        data.extend_from_slice(frame.uv_plane);

        let texture = device.create_texture_with_data(
            queue,
            &wgpu::TextureDescriptor {
                label: Some("FrameUploader NV12"),
                size,
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu_format,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            },
            wgpu::util::TextureDataOrder::LayerMajor,
            &data,
        );

        Ok(FrameResource {
            texture: Arc::new(texture),
            format: frame.format,
            size,
            color_info: frame.color_info.clone(),
            provenance: FrameSource::CpuNv12 {
                width: frame.width,
                height: frame.height,
            },
            sequence: frame.sequence,
        })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_color_info_default_is_bt709_limited() {
        let info = FrameColorInfo::default();
        assert_eq!(info.primaries, ColorPrimaries::Bt709);
        assert_eq!(info.transfer_function, TransferFunction::Bt709);
        assert_eq!(info.matrix, ColorMatrix::Bt709);
        assert_eq!(info.range, ColorRange::Limited);
        assert!(!info.is_hdr());
    }

    #[test]
    fn hdr10_color_info_is_hdr() {
        let info = FrameColorInfo::hdr10();
        assert_eq!(info.primaries, ColorPrimaries::Bt2020);
        assert_eq!(info.transfer_function, TransferFunction::Pq);
        assert!(info.is_hdr());
    }

    #[test]
    fn hlg_transfer_function_is_hdr() {
        let info = FrameColorInfo {
            transfer_function: TransferFunction::Hlg,
            ..Default::default()
        };
        assert!(info.is_hdr());
    }

    #[test]
    fn bt709_is_not_hdr() {
        let info = FrameColorInfo::default();
        assert!(!info.is_hdr());
    }

    #[test]
    fn video_pixel_format_nv12_wgpu_format() {
        assert_eq!(
            VideoPixelFormat::Nv12.wgpu_format(),
            wgpu::TextureFormat::NV12
        );
    }

    #[test]
    fn video_pixel_format_rgba8_wgpu_format() {
        assert_eq!(
            VideoPixelFormat::Rgba8.wgpu_format(),
            wgpu::TextureFormat::Rgba8Unorm
        );
    }

    #[test]
    fn video_pixel_format_rgba16f_wgpu_format() {
        assert_eq!(
            VideoPixelFormat::Rgba16F.wgpu_format(),
            wgpu::TextureFormat::Rgba16Float
        );
    }

    #[test]
    fn color_range_default_is_limited() {
        assert_eq!(ColorRange::default(), ColorRange::Limited);
    }

    #[test]
    fn frame_source_dxgi_and_cpu_are_distinct() {
        let dxgi = FrameSource::DxgiNv12 {
            width: 1920,
            height: 1080,
        };
        let cpu = FrameSource::CpuNv12 {
            width: 1920,
            height: 1080,
        };
        assert_ne!(dxgi, cpu);
    }

    #[test]
    fn frame_color_info_fields_preserved() {
        let info = FrameColorInfo {
            primaries: ColorPrimaries::Bt2020,
            transfer_function: TransferFunction::Pq,
            matrix: ColorMatrix::Bt2020NonConstant,
            range: ColorRange::Full,
        };
        assert_eq!(info.primaries, ColorPrimaries::Bt2020);
        assert_eq!(info.range, ColorRange::Full);
        assert!(info.is_hdr());
    }
}
