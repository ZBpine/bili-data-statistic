import { useSsrAdapter } from '@css-render/vue3-ssr';
import { cssrAnchorMetaName } from './common';

export function useTheme(mountId, style, mountTarget, anchorMetaName) {
  const ssrAdapter = useSsrAdapter();
  const parent = mountTarget || document.head;

  const mountStyle = () => {
    style.mount({
      id: mountId,
      head: true,
      anchorMetaName: anchorMetaName || cssrAnchorMetaName,
      ssr: ssrAdapter,
      parent,
    });
  };

  if (ssrAdapter) {
    mountStyle();
  } else {
    onBeforeMount(mountStyle);
  }
}
