import { useEffect, useState } from "react";

import { Image, ImageStyle, StyleProp, View, StyleSheet } from "react-native";

import { supabase } from "@/lib/supabase";

// Картинка из приватного хранилища: получает временную ссылку (действует один час)
export default function SecureImage({
  bucket,
  path,
  style,
}: {
  bucket: string;
  path: string | null | undefined;
  style?: StyleProp<ImageStyle>;
}) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setUri(null);

    if (!path) return;

    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUri(data.signedUrl);
      });

    return () => {
      active = false;
    };
  }, [bucket, path]);

  if (!uri) return <View style={[style, styles.placeholder]} />;

  return <Image source={{ uri }} style={style} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#fdeef3",
  },
});
