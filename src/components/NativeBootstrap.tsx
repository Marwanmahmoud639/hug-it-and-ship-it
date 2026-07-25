import { useNativeBootstrap } from "@/hooks/use-native-bootstrap";

/**
 * Mounts native-only side effects (push registration, notification handlers).
 * Renders nothing on web.
 */
export function NativeBootstrap() {
  useNativeBootstrap();
  return null;
}
