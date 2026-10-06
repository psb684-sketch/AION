//! Frame presentation deadline — Phase 5.
//!
//! [`FrameDeadline`] replaces the bare [`FramePriority`] in
//! [`FrameScheduler::request`]. It encodes both *what class of work this is*
//! and *when it must be finished* — giving the scheduler enough information to
//! order two `Realtime` requests correctly (the one due sooner wins).
//!
//! # Ordering contract
//!
//! `FrameDeadline` implements `Ord` so it can be pushed into a
//! [`BinaryHeap`](std::collections::BinaryHeap). The **most urgent** deadline
//! (earliest `present_by`) is *greater* in this ordering, so it is popped
//! first from a max-heap.
//!
//! Within equal deadlines, higher [`FramePriority`] wins.

use crate::wgpu_compositor::frame_request::FramePriority;
use std::cmp::Ordering;
use std::time::{Duration, Instant};

/// Presentation deadline for a single frame.
///
/// Carries both the absolute wall-clock deadline and the priority class.
/// Used by [`PerformanceManager`] and [`FrameScheduler`] to order work.
#[derive(Debug, Clone)]
pub struct FrameDeadline {
    /// Absolute wall-clock instant by which the frame must be presented.
    /// After this point the frame is useless (missed deadline).
    pub present_by: Instant,
    /// Priority class — used as a tiebreaker when two deadlines are equal.
    pub priority: FramePriority,
}

impl FrameDeadline {
    /// Deadline for a single frame at the given frame rate.
    ///
    /// ```rust,ignore
    /// // 60 FPS → 16.67 ms from now
    /// let d = FrameDeadline::for_fps(60.0, FramePriority::Realtime);
    /// ```
    pub fn for_fps(fps: f64, priority: FramePriority) -> Self {
        let frame_us = (1_000_000.0 / fps) as u64;
        Self {
            present_by: Instant::now() + Duration::from_micros(frame_us),
            priority,
        }
    }

    /// Deadline of "right now" — the frame is due immediately.
    ///
    /// Used for scrubbing (Interactive) or single-frame export (Background)
    /// where the caller wants the frame as soon as possible rather than by a
    /// specific future instant.
    pub fn immediate(priority: FramePriority) -> Self {
        Self {
            present_by: Instant::now(),
            priority,
        }
    }

    /// True if the deadline has already passed.
    pub fn is_expired(&self) -> bool {
        Instant::now() >= self.present_by
    }

    /// Remaining time until the deadline. `None` if already expired.
    pub fn time_remaining(&self) -> Option<Duration> {
        self.present_by.checked_duration_since(Instant::now())
    }
}

// ---------------------------------------------------------------------------
// Ordering — most urgent (earliest) is "greater" for BinaryHeap
// ---------------------------------------------------------------------------

impl PartialEq for FrameDeadline {
    fn eq(&self, other: &Self) -> bool {
        self.present_by == other.present_by && self.priority == other.priority
    }
}

impl Eq for FrameDeadline {}

impl PartialOrd for FrameDeadline {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for FrameDeadline {
    /// Earlier `present_by` → more urgent → ordered as *Greater* so it pops
    /// first from a [`BinaryHeap`](std::collections::BinaryHeap).
    fn cmp(&self, other: &Self) -> Ordering {
        match other.present_by.cmp(&self.present_by) {
            // self is earlier (more urgent) → Greater
            Ordering::Greater => Ordering::Greater,
            Ordering::Less => Ordering::Less,
            // Equal deadlines: higher FramePriority wins
            Ordering::Equal => self.priority.cmp(&other.priority),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::wgpu_compositor::frame_request::FramePriority;
    use std::collections::BinaryHeap;

    #[test]
    fn earlier_deadline_is_more_urgent() {
        let sooner = FrameDeadline {
            present_by: Instant::now() + Duration::from_millis(8),
            priority: FramePriority::Realtime,
        };
        let later = FrameDeadline {
            present_by: Instant::now() + Duration::from_millis(24),
            priority: FramePriority::Realtime,
        };
        assert!(
            sooner > later,
            "Earlier deadline must be 'greater' (more urgent) in Ord"
        );
    }

    #[test]
    fn equal_deadline_higher_priority_wins() {
        let now = Instant::now() + Duration::from_millis(16);
        let rt = FrameDeadline {
            present_by: now,
            priority: FramePriority::Realtime,
        };
        let bg = FrameDeadline {
            present_by: now,
            priority: FramePriority::Background,
        };
        assert!(
            rt > bg,
            "Same deadline: higher priority class is more urgent"
        );
    }

    #[test]
    fn binary_heap_pops_earliest_deadline_first() {
        let mut heap = BinaryHeap::new();
        heap.push(FrameDeadline {
            present_by: Instant::now() + Duration::from_millis(50),
            priority: FramePriority::Realtime,
        });
        heap.push(FrameDeadline {
            present_by: Instant::now() + Duration::from_millis(10),
            priority: FramePriority::Realtime,
        });
        heap.push(FrameDeadline {
            present_by: Instant::now() + Duration::from_millis(30),
            priority: FramePriority::Realtime,
        });
        // Most urgent (10ms) should pop first.
        let first = heap.pop().unwrap();
        let second = heap.pop().unwrap();
        assert!(
            first.present_by < second.present_by,
            "Heap must pop earliest deadline first"
        );
    }

    #[test]
    fn for_fps_deadline_is_in_the_future() {
        let d = FrameDeadline::for_fps(60.0, FramePriority::Realtime);
        assert!(!d.is_expired(), "60fps deadline must be in the future");
        let remaining = d.time_remaining().expect("must have remaining time");
        assert!(
            remaining <= Duration::from_millis(17),
            "16.67ms frame duration"
        );
        assert!(remaining > Duration::from_millis(0), "must be positive");
    }

    #[test]
    fn immediate_deadline_is_expired_or_about_to_expire() {
        let d = FrameDeadline::immediate(FramePriority::Realtime);
        // Allow 1 ms of slack for the test itself to run.
        let remaining = d.time_remaining().unwrap_or(Duration::ZERO);
        assert!(
            remaining < Duration::from_millis(1),
            "immediate deadline must be now or past"
        );
    }

    #[test]
    fn time_remaining_returns_none_after_expiry() {
        let past = FrameDeadline {
            present_by: Instant::now() - Duration::from_millis(1),
            priority: FramePriority::Background,
        };
        assert!(past.is_expired());
        assert!(past.time_remaining().is_none());
    }
}
