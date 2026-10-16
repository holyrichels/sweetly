import RoomSection from "@/components/room-section";

export default function RoomPlansScreen() {
  return (
    <RoomSection
      config={{
        title: "Планы",
        table: "couple_plans",
        titleLabel: "Что сделать",
        placeholder: "Что хотите сделать вместе",
        toggleCol: "done",
        emptyText: "Пока нет планов. Добавьте первый.",
      }}
    />
  );
}
