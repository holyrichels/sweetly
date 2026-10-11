import { ReactNode, useEffect, useState } from "react";

import { Image, ImageStyle, StyleProp, View, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";

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
  const [uri, setUri] = useState<string | null>(null);

  const [failed, setFailed] = useState(false);

  // Старые аватарки сохранены как публичные ссылки, а хранилище теперь приватное
  const isLegacyUrl = !!path && path.startsWith("http");

  useEffect(() => {
    let active = true;

    setUri(null);
    setFailed(false);

    if (!path || isLegacyUrl) {
      setFailed(true);

      return;
    }

    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!active) return;

        if (error || !data?.signedUrl) {
          setFailed(true);
        } else {
          setUri(data.signedUrl);
        }
      });

    return () => {
      active = false;
    };
  }, [bucket, path]);

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
    backgroundColor: "#fdeef3",
  },
});
