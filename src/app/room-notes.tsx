import RoomSection from "@/components/room-section";

export default function RoomNotesScreen() {
  return (
    <RoomSection
      config={{
        title: "Заметки",
        table: "couple_notes",
        titleLabel: "Заметка",
        placeholder: "Мелочь, которую важно помнить",
        toggleCol: "pinned",
        emptyText: "Пока нет заметок. Добавьте первую.",
      }}
    />
  );
}
