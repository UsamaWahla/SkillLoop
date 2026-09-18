export const MIN_HOLD_MS = 500;
export const SLIDE_CANCEL_PX = 72;

export function isSlideCancel(startX: number, pageX: number, thresholdPx = SLIDE_CANCEL_PX) {
  return startX - pageX >= thresholdPx;
}

export function shouldDiscardVoiceHold(params: {
  cancelled: boolean;
  heldMs: number;
  wasRecording: boolean;
  minHoldMs?: number;
}) {
  const minHoldMs = params.minHoldMs ?? MIN_HOLD_MS;
  return params.cancelled || params.heldMs < minHoldMs || !params.wasRecording;
}
