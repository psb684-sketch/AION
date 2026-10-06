use serde::{Deserialize, Serialize};

/// Capability-negotiated rendering hardware capabilities.
/// Probed once at GPU initialization and cached for the session lifetime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreviewCapabilities {
    /// wgpu device supports TEXTURE_FORMAT_NV12 biplanar views.
    pub wgpu_nv12: bool,
    /// wgpu backend is DX12, enabling DXGI shared handle import on Windows.
    pub dxgi_import: bool,
    /// FFmpeg D3D11VA hardware decode is available on this adapter.
    pub hw_decode: bool,
    /// Native HWND/NSWindow/X11 surface presentation is available.
    pub native_surface: bool,
    /// HDR surface format is supported (Rgba16Float or P010).
    pub hdr: bool,
}

impl PreviewCapabilities {
    /// Probe capabilities given the active wgpu adapter and device.
    pub fn probe(adapter: &wgpu::Adapter, device: &wgpu::Device) -> Self {
        let info = adapter.get_info();
        let features = device.features();
        let wgpu_nv12 = features.contains(wgpu::Features::TEXTURE_FORMAT_NV12);
        let dxgi_import = cfg!(target_os = "windows") && info.backend == wgpu::Backend::Dx12;
        let hw_decode = cfg!(target_os = "windows") || cfg!(target_os = "macos");
        let hdr = features.contains(wgpu::Features::TEXTURE_FORMAT_16BIT_NORM);

        Self {
            wgpu_nv12,
            dxgi_import,
            hw_decode,
            native_surface: true,
            hdr,
        }
    }

    /// Returns true if the full zero-copy DXGI pipeline is available.
    #[allow(dead_code)]
    pub fn zero_copy_available(&self) -> bool {
        self.dxgi_import && self.wgpu_nv12 && self.hw_decode
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_copy_available_requires_all_three() {
        let caps = PreviewCapabilities {
            wgpu_nv12: true,
            dxgi_import: true,
            hw_decode: true,
            native_surface: true,
            hdr: false,
        };
        assert!(caps.zero_copy_available());

        let caps_no_nv12 = PreviewCapabilities {
            wgpu_nv12: false,
            ..caps.clone()
        };
        assert!(!caps_no_nv12.zero_copy_available());

        let caps_no_dxgi = PreviewCapabilities {
            dxgi_import: false,
            ..caps.clone()
        };
        assert!(!caps_no_dxgi.zero_copy_available());

        let caps_no_hw = PreviewCapabilities {
            hw_decode: false,
            ..caps.clone()
        };
        assert!(!caps_no_hw.zero_copy_available());
    }
}
