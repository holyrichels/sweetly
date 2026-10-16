import RoomSection from "@/components/room-section";

export default function RoomWishesScreen() {
  return (
    <RoomSection
      config={{
        title: "Желания",
        table: "couple_wishes",
        titleLabel: "Что хочется",
        placeholder: "Что хочется получить",
        extraCol: "price",
        extraLabel: "Цена или ссылка",
        emptyText: "Пока нет желаний. Добавьте первое.",
      }}
    />
  );
}
