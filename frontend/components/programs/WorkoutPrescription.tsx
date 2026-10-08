import type { WorkoutExercise } from "@/lib/types";
import ExerciseVideo from "@/components/ExerciseVideo";
import styles from "./TrainingPresentation.module.css";

export default function WorkoutPrescription({ exercises }: { exercises: WorkoutExercise[] }) {
  return <div className={styles.prescriptionList}>
    {exercises.map((ex, i) => <article key={`${ex.id ?? ex.name}-${i}`} className={styles.prescriptionCard}>
      <div className={styles.prescriptionTitle}><span>{String(ex.order || i + 1).padStart(2, "0")}</span><div><h4>{ex.name}</h4>{ex.phase && <small>{{warmup:"Aquecimento",main:"Principal",cardio:"Cardio",stretching:"Alongamento"}[ex.phase]}</small>}</div></div>
      <dl className={styles.prescriptionValues}>
        <div><dt>Séries</dt><dd>{ex.sets || "Não informadas"}</dd></div>
        <div><dt>Repetições</dt><dd>{ex.repetitions || "Não informadas"}</dd></div>
        <div><dt>Carga</dt><dd>{ex.weight || "Não informada"}</dd></div>
        <div><dt>Descanso</dt><dd>{ex.restSeconds ? `${ex.restSeconds}s` : "Não informado"}</dd></div>
      </dl>
      {ex.description && <p className={styles.prescriptionNote}>{ex.description}</p>}
      {ex.notes && <p className={styles.prescriptionNote}>{ex.notes}</p>}
      {[...new Set([ex.videoUrl, ...(ex.videoUrls ?? [])].filter((url): url is string => Boolean(url)))].map(url => <ExerciseVideo key={url} url={url} title={`Ver execução · ${ex.name}`} />)}
    </article>)}
  </div>;
}
