import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import SecureImage from "@/components/secure-image";
import SoloScreen from "@/components/solo-screen";
import SkeletonScreen from "@/components/skeleton-screen";
import { useAppData } from "@/lib/app-data";

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const SHARED = [
  { title: "Планы", desc: "Что хотите сделать вместе", d: "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4" },
  { title: "Желания", desc: "Подарки и мечты друг друга", d: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-3 0-4-4-1.5-4S12 7 12 7zM12 7c3 0 4-4 1.5-4S12 7 12 7z" },
  { title: "Места", desc: "Куда съездить и где побывать", d: "M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM10 10a2 2 0 104 0 2 2 0 10-4 0" },
  { title: "Заметки", desc: "Мелочи, которые важно помнить", d: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" },
];

export default function RoomScreen() {
  const router = useRouter();

  const appData = useAppData();

  const partnerName = appData.partner?.name || "партнёром";

  if (!appData.ready) return <SkeletonScreen />;

  if (!appData.coupleId) return <SoloScreen kind="room" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Комната</Text>
      <Text style={styles.subtitle}>Ваше общее пространство</Text>

      {/* ============ ПАРА ============ */}

      <View style={styles.pairCard}>
        <View style={styles.avatars}>
          <View style={styles.avatarBack}>
            <SecureImage
              bucket="avatars"
              path={appData.partner?.avatar_url}
              style={styles.avatarImage}
            />
          </View>

          <View style={styles.avatarFront}>
            <SecureImage
              bucket="avatars"
              path={appData.me?.avatar_url}
              style={styles.avatarImage}
            />
          </View>
        </View>

        <View style={styles.pairText}>
          <Text style={styles.pairTitle}>Вы с {partnerName}</Text>
          <Text style={styles.pairSub}>Всё важное — в одном месте</Text>
        </View>
      </View>

      {/* ============ СМОТРЕТЬ ВМЕСТЕ ============ */}

      <Pressable style={styles.watchCard} onPress={() => router.push("/watch" as any)}>
        <View style={styles.playCircle}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
          </Svg>
        </View>

        <View style={styles.watchText}>
          <Text style={styles.watchTitle}>Смотреть вместе</Text>
          <Text style={styles.watchSub}>Одно видео на двоих</Text>
        </View>

        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M9 6l6 6-6 6" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      {/* ============ ЧТО У ВАС ОБЩЕГО ============ */}

      <Text style={styles.sectionLabel}>ЧТО У ВАС ОБЩЕГО</Text>

      <View style={styles.grid}>
        {SHARED.map((item) => (
          <Pressable
            key={item.title}
            style={styles.gridCard}
            onPress={() => notify("Скоро", `Раздел «${item.title}» появится в следующем обновлении`)}
          >
            <View style={styles.gridIcon}>
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path d={item.d} fill="none" stroke="#C23A62" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <Text style={styles.gridTitle}>{item.title}</Text>
            <Text style={styles.gridDesc}>{item.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.addButton}
        onPress={() => notify("Скоро", "Добавление появится в следующем обновлении")}
      >
        <Text style={styles.addText}>+  Добавить в комнату</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF1F0",
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  title: {
    color: "#3B1F2B",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 40,
  },

  subtitle: {
    color: "#7A5A66",
    fontSize: 16,
    marginTop: 4,
    marginBottom: 22,
  },

  pairCard: {
    backgroundColor: "#C23A62",
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  avatars: {
    width: 90,
    height: 58,
  },

  avatarBack: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    position: "absolute",
    left: 0,
    top: 1,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#C23A62",
  },

  avatarFront: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFE6DB",
    position: "absolute",
    left: 28,
    top: 1,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#C23A62",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  pairText: {
    flex: 1,
    marginLeft: 6,
  },

  pairTitle: {
    color: "#FFFFFF",
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
  },

  pairSub: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.85,
    marginTop: 4,
  },

  watchCard: {
    marginTop: 14,
    backgroundColor: "#3B1F2B",
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },

  watchText: {
    flex: 1,
  },

  watchTitle: {
    color: "#FFFFFF",
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
  },

  watchSub: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },

  sectionLabel: {
    color: "#7A5A66",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    letterSpacing: 0.4,
    marginTop: 24,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    minHeight: 170,
  },

  gridIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFE6DB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  gridTitle: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
  },

  gridDesc: {
    color: "#7A5A66",
    fontSize: 14,
    marginTop: 4,
    lineHeight: 19,
  },

  addButton: {
    marginTop: 16,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#E3B7C2",
    alignItems: "center",
    justifyContent: "center",
  },

  addText: {
    color: "#C23A62",
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },
});
