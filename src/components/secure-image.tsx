import { ReactNode, useEffect, useState } from "react";

import { Image, ImageStyle, StyleProp, View, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";

// Кэш временных ссылок: одна и та же картинка не запрашивается заново на каждой странице
const urlCache = new Map<string, { url: string; expires: number }>();

const pendingRequests = new Map<string, Promise<string | null>>();

const URL_LIFETIME_MS = 50 * 60 * 1000;

function cachedUrl(bucket: string, path: string): string | null {
  const entry = urlCache.get(`${bucket}/${path}`);

  return entry && entry.expires > Date.now() ? entry.url : null;
}

function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}/${path}`;

  const cached = cachedUrl(bucket, path);

  if (cached) return Promise.resolve(cached);

  const pending = pendingRequests.get(key);

  if (pending) return pending;

  const request = supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600)
    .then(({ data, error }) => {
      pendingRequests.delete(key);

      if (error || !data?.signedUrl) return null;

      urlCache.set(key, { url: data.signedUrl, expires: Date.now() + URL_LIFETIME_MS });

      return data.signedUrl;
    });

  pendingRequests.set(key, request);

  return request;
}

// Картинка из приватного хранилища. Пока грузится или если файла нет,
// показываем fallback (например, букву имени), а не пустой кружок.
export default function SecureImage({
  bucket,
  path,
  style,
  fallback,
}: {
  bucket: string;
  path: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  fallback?: ReactNode;
}) {
  // Старые аватарки сохранены как публичные ссылки, а хранилище теперь приватное
  const isLegacyUrl = !!path && path.startsWith("http");

  const validPath = !!path && !isLegacyUrl ? path : null;

  // Если ссылка уже в кэше, показываем картинку сразу, без мигания
  const [uri, setUri] = useState<string | null>(() =>
    validPath ? cachedUrl(bucket, validPath) : null,
  );

  const [failed, setFailed] = useState(!validPath);

  useEffect(() => {
    let active = true;

    if (!validPath) {
      setUri(null);
      setFailed(true);

      return;
    }

    const cached = cachedUrl(bucket, validPath);

    if (cached) {
      setUri(cached);
      setFailed(false);

      return;
    }

    setUri(null);
    setFailed(false);

    getSignedUrl(bucket, validPath).then((url) => {
      if (!active) return;

      if (url) {
        setUri(url);
      } else {
        setFailed(true);
      }
    });

    return () => {
      active = false;
    };
  }, [bucket, validPath]);

  if (failed) {
    return <>{fallback ?? <View style={[style, styles.placeholder]} />}</>;
  }

  if (!uri) {
    return <View style={[style, styles.placeholder]} />;
  }

  return <Image source={{ uri }} style={style} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#FFE6DB",
  },
});
