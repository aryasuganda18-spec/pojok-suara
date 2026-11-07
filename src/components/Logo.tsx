import { useSite, useTheme } from '../hooks/contexts';

/** Logo situs. Memakai logo dari CMS bila diatur; bila tidak, logo bawaan (tersedia versi terang dan gelap). */
export function Logo({ height = 40 }: { height?: number }) {
  const { site } = useSite();
  const { mode } = useTheme();
  const custom = site?.logo;
  const src = custom ? custom.thumb : mode === 'dark' ? '/images/logo-dark.webp' : '/images/logo.webp';
  const ratio = custom?.width && custom?.height ? custom.width / custom.height : 554 / 220;
  return (
    <img
      src={src}
      alt={site?.site_name ?? 'POJOK SUARA'}
      width={Math.round(height * ratio)}
      height={height}
      style={{ height, width: 'auto' }}
      decoding="async"
      fetchPriority="high"
    />
  );
}
