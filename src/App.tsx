import { DesktopApp } from './desktop/DesktopApp';
import { useMediaQuery } from './lib/hooks';
import { MobileApp } from './mobile/MobileApp';

/** Sous 900 px : composition mobile dédiée (scène simplifiée, feuilles), pas le desktop réduit. */
export default function App() {
  const mobile = useMediaQuery('(max-width: 899px)');
  return mobile ? <MobileApp /> : <DesktopApp />;
}
