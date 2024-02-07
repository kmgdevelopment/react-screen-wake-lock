import * as React from 'react';

const warn = (content: string) =>
  console.warn('[react-screen-wake-lock]: ' + content);

export interface WakeLockOptions {
  onError?: (error: Error) => void;
  onRequest?: () => void;
  onRelease?: EventListener;
  onDestroy?: () => void;
}

export const useWakeLock = ({
  onError,
  onRequest,
  onRelease,
  onDestroy,
}: WakeLockOptions | undefined = {}) => {
  const [released, setReleased] = React.useState<boolean | undefined>();
  const wakeLock = React.useRef<WakeLockSentinel | null>(null);

  // https://caniuse.com/mdn-api_wakelock
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const request = React.useCallback(
    async (type: WakeLockType = 'screen') => {
      const isWakeLockAlreadyDefined = wakeLock.current != null;
      if (!isSupported) {
        return warn(
          "Calling the `request` function has no effect, Wake Lock Screen API isn't supported"
        );
      }
      if (isWakeLockAlreadyDefined) {
        destroy();
      }

      try {
        wakeLock.current = await navigator.wakeLock.request(type);

        wakeLock.current.onrelease = (e: Event) => {
          // Default to `true` - `released` API is experimental: https://caniuse.com/mdn-api_wakelocksentinel_released
          setReleased((wakeLock.current && wakeLock.current.released) || true);
          onRelease && onRelease(e);
        };

        document.addEventListener('visibilitychange', handleVisibilityReturn);

        onRequest && onRequest();
        setReleased((wakeLock.current && wakeLock.current.released) || false);
      } catch (error: any) {
        onError && onError(error);
      }
    },
    [isSupported, onRequest, onError, onRelease]
  );

  const handleVisibilityReturn = () => {
    if( 
        document.visibilityState == 'visible'
        && wakeLock.current 
        && wakeLock.current.released
    ) {
        request();
    }
  };

  const release = React.useCallback(async () => {
    const isWakeLockUndefined = wakeLock.current == null;
    if (!isSupported) {
      return warn(
        "Calling the `release` function has no effect, Wake Lock Screen API isn't supported"
      );
    }

    if (isWakeLockUndefined) {
      return warn('Calling `release` before `request` has no effect.');
    }

    wakeLock.current && (await wakeLock.current.release());
  }, [isSupported]);

  const destroy = React.useCallback(async () => {
    const isWakeLockUndefined = wakeLock.current == null;

    if (!isSupported) {
      return warn(
        "Calling the `destroy` function has no effect, Wake Lock Screen API isn't supported"
      );
    }

    if (isWakeLockUndefined) {
      return warn('Calling `destroy` before `request` has no effect.');
    }

    wakeLock.current && (await wakeLock.current.release().then(() => {
      document.removeEventListener('visibilitychange', handleVisibilityReturn);
      wakeLock.current = null;
      onDestroy && onDestroy();
    }));
  }, [isSupported, onDestroy])

  return {
    isSupported,
    request,
    released,
    release,
    destroy,
    type: (wakeLock.current && wakeLock.current.type) || undefined,
  };
};
