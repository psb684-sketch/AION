//! Count-bounded LRU cache used by the frame scheduler.
//!
//! [`FrameResourceCache<K, V>`] is a generic LRU keyed on any `Hash + Eq`
//! type. Two concrete instantiations appear in [`super::frame_scheduler`]:
//!
//! - `FrameResourceCache<DecodedCacheKey, Arc<FrameResource>>`
//!   Raw decoded frames, keyed **without** `render_revision`. A timeline edit
//!   (effects/transitions) invalidates the composition cache without discarding
//!   the decode result.
//!
//! - `FrameResourceCache<FrameKey, Arc<FrameResource>>`
//!   Composed frames, keyed with the full `FrameKey` including `render_revision`.

use std::collections::{HashMap, VecDeque};
use std::hash::Hash;

/// Count-bounded LRU cache.
///
/// Evicts the least-recently-used entry when capacity is exceeded.
/// All operations are O(n) in the worst case for the `VecDeque` retain;
/// Phase 5 can upgrade to an intrusive linked-hash-map if needed.
pub struct FrameResourceCache<K, V> {
    capacity: usize,
    entries: HashMap<K, V>,
    order: VecDeque<K>,
}

impl<K: Hash + Eq + Clone, V: Clone> FrameResourceCache<K, V> {
    /// Create a cache with the given maximum entry count.
    /// Clamped to a minimum of 1.
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity: capacity.max(1),
            entries: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    /// Look up an entry. Promotes it to most-recently-used on hit.
    pub fn get(&mut self, key: &K) -> Option<V> {
        if !self.entries.contains_key(key) {
            return None;
        }
        self.touch(key);
        self.entries.get(key).cloned()
    }

    /// Peek without promoting (does not affect LRU order).
    pub fn peek(&self, key: &K) -> Option<&V> {
        self.entries.get(key)
    }

    /// Insert an entry. Evicts the LRU entry if at capacity.
    /// If the key already exists the entry is updated in-place and promoted.
    pub fn insert(&mut self, key: K, value: V) {
        if self.entries.contains_key(&key) {
            self.order.retain(|k| k != &key);
        } else if self.entries.len() >= self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            }
        }
        self.order.push_back(key.clone());
        self.entries.insert(key, value);
    }

    /// Remove an entry if present.
    pub fn remove(&mut self, key: &K) {
        if self.entries.remove(key).is_some() {
            self.order.retain(|k| k != key);
        }
    }

    /// Discard all entries.
    pub fn clear(&mut self) {
        self.entries.clear();
        self.order.clear();
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    fn touch(&mut self, key: &K) {
        self.order.retain(|k| k != key);
        self.order.push_back(key.clone());
    }
}

// ---------------------------------------------------------------------------
// Tests — use cheap numeric types so no GPU device is required.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    type Cache = FrameResourceCache<u64, u32>;

    #[test]
    fn returns_inserted_value() {
        let mut c: Cache = FrameResourceCache::new(4);
        c.insert(1, 100);
        assert_eq!(c.get(&1), Some(100));
    }

    #[test]
    fn miss_returns_none() {
        let mut c: Cache = FrameResourceCache::new(4);
        assert_eq!(c.get(&99), None);
    }

    #[test]
    fn evicts_lru_when_at_capacity() {
        let mut c: Cache = FrameResourceCache::new(2);
        c.insert(1, 1);
        c.insert(2, 2);
        // Touch 1 so 2 becomes LRU.
        let _ = c.get(&1);
        // Insert 3 — should evict 2.
        c.insert(3, 3);
        assert_eq!(c.get(&1), Some(1));
        assert_eq!(c.get(&2), None, "LRU entry must be evicted");
        assert_eq!(c.get(&3), Some(3));
    }

    #[test]
    fn update_existing_key_does_not_grow_len() {
        let mut c: Cache = FrameResourceCache::new(4);
        c.insert(1, 10);
        c.insert(1, 20);
        assert_eq!(c.len(), 1);
        assert_eq!(c.get(&1), Some(20));
    }

    #[test]
    fn remove_shrinks_len() {
        let mut c: Cache = FrameResourceCache::new(4);
        c.insert(1, 10);
        c.remove(&1);
        assert!(c.is_empty());
        assert_eq!(c.get(&1), None);
    }

    #[test]
    fn clear_empties_all() {
        let mut c: Cache = FrameResourceCache::new(4);
        c.insert(1, 10);
        c.insert(2, 20);
        c.clear();
        assert!(c.is_empty());
    }

    #[test]
    fn capacity_minimum_is_one() {
        let c: Cache = FrameResourceCache::new(0);
        assert_eq!(c.capacity(), 1);
    }

    #[test]
    fn peek_does_not_promote() {
        let mut c: Cache = FrameResourceCache::new(2);
        c.insert(1, 1);
        c.insert(2, 2);
        // Peek at 1 — does NOT promote.
        assert_eq!(c.peek(&1), Some(&1));
        // Insert 3 — 1 is still LRU, so it is evicted.
        c.insert(3, 3);
        assert_eq!(c.get(&1), None, "peek must not promote");
        assert_eq!(c.get(&2), Some(2));
    }

    #[test]
    fn insert_beyond_capacity_maintains_capacity_bound() {
        let mut c: Cache = FrameResourceCache::new(3);
        for i in 0..10u64 {
            c.insert(i, i as u32);
        }
        assert!(c.len() <= 3);
    }
}
