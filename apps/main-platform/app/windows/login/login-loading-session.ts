type LoadingSessionState = {
  exitAccepted: boolean;
  revealComplete: boolean;
  sessionId: number;
  tipId: string | null;
};

export function createLoginLoadingSessionController() {
  let nextSessionId = 0;
  let state: LoadingSessionState = {
    exitAccepted: false,
    revealComplete: false,
    sessionId: 0,
    tipId: null,
  };

  const isCurrent = (sessionId: number) => state.sessionId === sessionId;
  const isTipActive = (sessionId: number, tipId: string) =>
    isCurrent(sessionId) && state.tipId === tipId;

  return {
    acceptExit(sessionId: number, tipId: string) {
      if (!isTipActive(sessionId, tipId) || !state.revealComplete || state.exitAccepted) {
        return false;
      }

      state.exitAccepted = true;
      return true;
    },
    activateTip(sessionId: number, tipId: string) {
      if (!isCurrent(sessionId)) {
        return false;
      }

      state.tipId = tipId;
      state.revealComplete = false;
      state.exitAccepted = false;
      return true;
    },
    begin() {
      nextSessionId += 1;
      state = {
        exitAccepted: false,
        revealComplete: false,
        sessionId: nextSessionId,
        tipId: null,
      };
      return nextSessionId;
    },
    isCurrent,
    isExitAccepted(sessionId: number, tipId: string) {
      return isTipActive(sessionId, tipId) && state.exitAccepted;
    },
    isRevealComplete(sessionId: number, tipId: string) {
      return isTipActive(sessionId, tipId) && state.revealComplete;
    },
    isTipActive,
    markRevealComplete(sessionId: number, tipId: string) {
      if (!isTipActive(sessionId, tipId)) {
        return false;
      }

      state.revealComplete = true;
      return true;
    },
  };
}
