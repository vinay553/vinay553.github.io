"""Worked solution to playout_exercise.py. Run its tests with --reference."""
from collections import deque


class PlayoutQueue:
    def __init__(self, budget_ms):
        self.budget_ms = budget_ms
        self.queued_ms = 0
        self.generation = 0
        self.last_accepted = -1
        self.pending = deque()

    def begin(self, generation):
        if generation <= self.generation:
            return False
        self.generation = generation
        self.last_accepted = -1
        self.queued_ms = 0
        self.pending.clear()
        return True

    def offer(self, generation, seq, duration_ms):
        if generation != self.generation or seq <= self.last_accepted:
            return False
        if duration_ms <= 0 or duration_ms + self.queued_ms > self.budget_ms:
            return False
        self.pending.append((generation, seq, duration_ms))
        self.last_accepted = seq
        self.queued_ms += duration_ms
        return True

    def pop(self):
        if not self.pending:
            return None
        chunk = self.pending.popleft()
        self.queued_ms -= chunk[2]
        return chunk
