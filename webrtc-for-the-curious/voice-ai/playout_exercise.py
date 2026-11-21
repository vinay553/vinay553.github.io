"""Voice AI interview exercise. Requires Python 3.8 or newer.

Save this file, implement PlayoutQueue, then run: python3 playout_exercise.py
To compare with the worked implementation, save playout_reference.py beside it
and run: python3 playout_exercise.py --reference

One event loop owns this queue. Callbacks within a generation arrive in
nondecreasing sequence order, possibly with duplicates. Old generations can
arrive at any time. Times, generations and sequence numbers are integers.
The playout consumer pops whole chunks. Keep offer and pop O(1).
Account for the work to release k pending chunks when changing generations.

A new instance starts at generation 0 with an empty queue. The supplied budget
is a positive number of milliseconds. begin(g) accepts strictly newer
generations, clears buffered audio and returns True. A repeated or older
generation returns False and preserves the current queue.

offer(g, seq, ms) returns True only for the active generation, a nonnegative
sequence greater than the last accepted sequence, a positive duration, and
enough free budget. A rejected offer changes no state and can be retried.
pop() returns the oldest (generation, sequence, duration_ms) or None and frees
its duration. queued_ms is the current number of milliseconds pending.
"""
import sys
import unittest


class PlayoutQueue:
    def __init__(self, budget_ms):
        self.budget_ms = budget_ms
        self.queued_ms = 0

    def begin(self, generation):
        raise NotImplementedError

    def offer(self, generation, seq, duration_ms):
        raise NotImplementedError

    def pop(self):
        raise NotImplementedError


class PlayoutTests(unittest.TestCase):
    def setUp(self):
        self.q = PlayoutQueue(60)

    def test_empty(self):
        self.assertIsNone(self.q.pop())
        self.assertEqual(self.q.queued_ms, 0)

    def test_fifo_and_exact_limit(self):
        self.assertTrue(self.q.offer(0, 0, 20))
        self.assertTrue(self.q.offer(0, 2, 40))
        self.assertEqual(self.q.queued_ms, 60)
        self.assertEqual(self.q.pop(), (0, 0, 20))
        self.assertEqual(self.q.pop(), (0, 2, 40))
        self.assertEqual(self.q.queued_ms, 0)

    def test_backpressure_can_retry(self):
        self.assertTrue(self.q.offer(0, 3, 45))
        self.assertFalse(self.q.offer(0, 4, 20))
        self.assertEqual(self.q.queued_ms, 45)
        self.q.pop()
        self.assertTrue(self.q.offer(0, 4, 20))

    def test_late_chunk_after_barge_in(self):
        self.q.offer(0, 0, 20)
        self.assertTrue(self.q.begin(1))
        self.assertEqual(self.q.queued_ms, 0)
        self.assertFalse(self.q.offer(0, 1, 20))
        self.assertIsNone(self.q.pop())
        self.assertTrue(self.q.offer(1, 0, 20))

    def test_duplicate_reset_preserves_audio(self):
        self.q.begin(3)
        self.q.offer(3, 1, 10)
        self.assertFalse(self.q.begin(3))
        self.assertFalse(self.q.begin(2))
        self.assertEqual(self.q.pop(), (3, 1, 10))

    def test_duplicate_after_playback(self):
        self.q.offer(0, 9, 20)
        self.q.pop()
        self.assertFalse(self.q.offer(0, 9, 20))
        self.assertFalse(self.q.offer(0, 8, 20))
        self.assertIsNone(self.q.pop())

    def test_invalid_or_future(self):
        for args in [(0, -1, 20), (0, 1, 0), (0, 1, -20), (1, 1, 20), (0, 1, 61)]:
            self.assertFalse(self.q.offer(*args))
        self.assertTrue(self.q.offer(0, 1, 60))


if __name__ == "__main__":
    if "--reference" in sys.argv:
        sys.argv.remove("--reference")
        from playout_reference import PlayoutQueue
    unittest.main(verbosity=2)
