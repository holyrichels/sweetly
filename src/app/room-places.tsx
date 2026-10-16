import RoomSection from "@/components/room-section";

export default function RoomPlacesScreen() {
  return (
    <RoomSection
      config={{
        title: "Места",
        table: "couple_places",
        titleLabel: "Место",
        placeholder: "Куда хотите съездить",
        extraCol: "address",
        extraLabel: "Адрес или комментарий",
        emptyText: "Пока нет мест. Добавьте первое.",
      }}
    />
  );
}
