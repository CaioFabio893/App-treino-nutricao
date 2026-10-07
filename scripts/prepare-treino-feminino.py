"""Prepare only: no cloud writes. Review JSON and video gaps before importing."""
import re,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/"docs/data/treino-feminino-fonte.md").read_text(encoding="utf-8-sig")
workouts=[]
for i,m in enumerate(re.finditer(r"^### (TREINO [A-D]|DIA [1-4]): (.+)$",text,re.M)):
 end=text.find("\n### ",m.end())
 body=text[m.end():end if end>=0 else len(text)]
 modality="gym" if m.group(1).startswith("TREINO") else "home"
 label=m.group(1).split()[-1]
 wid=f"treino-feminino-{modality}-{label.lower()}"
 exercises=[]
 for sm in re.finditer(r"^#### (.+)\n([\s\S]*?)(?=^#### |\Z)",body,re.M):
  title=sm.group(1);section=sm.group(2)
  phase="warmup" if "AQUECIMENTO" in title else "cardio" if "CARDIO" in title else "main"
  for em in re.finditer(r"^\* \*\*Exercício(?: \d+)?:\*\* (.+)\n([\s\S]*?)(?=^\* \*\*Exercício|\Z)",section,re.M):
   name=em.group(1).strip();detail=em.group(2).strip()
   inline=""
   if " — " in name: name,inline=name.split(" — ",1);inline=inline.replace("**","")
   fields=dict(re.findall(r"^\* \*\*([^*]+):\*\* (.+)$",detail,re.M))
   volume=fields.get("Séries x Repetições",fields.get("Volume",fields.get("Duração",inline)))
   sets=re.search(r"(\d+) séries",volume)
   duration=re.search(r"(\d+(?:[.,]\d+)?)(?: a \d+)? (minutos?|segundos?)",volume)
   secs=int(float(duration.group(1).replace(",","."))*(60 if duration.group(2).startswith("min") else 1)) if duration else 0
   # Pause at the top is not the full exercise duration.
   if "repetições" in volume: secs=0
   rest=re.search(r"(\d+) segundos",fields.get("Tempo de Descanso",fields.get("Descanso","")))
   exercises.append(dict(name=name,sets=int(sets.group(1)) if sets else 1,repetitions=volume,restSeconds=int(rest.group(1)) if rest else 0,order=len(exercises)+1,phase=phase,durationSeconds=secs,timerExcluded=phase=="cardio" and name=="Esteira Inclinada",notes="\n".join(f"{k}: {v}" for k,v in fields.items()),videoUrl=""))
 workouts.append(dict(id=wid,studentId="",name=f"{'Academia' if modality=='gym' else 'Em casa'} · {label} · {m.group(2)}",modality=modality,circuitSeconds=900 if modality=="home" else 0,description="AMRAP 15 a 20 minutos, após aquecimento; descanso conforme necessidade." if modality=="home" else "Sessão de 60 minutos. Prescrição original preservada nas observações.",exercises=exercises))
if len(workouts)!=8: raise ValueError(f"Expected 8 workouts, got {len(workouts)}")
program=dict(id="treino-feminino",studentId="",name="Treino Feminino",description="Academia e Em casa · escolha onde treinar",objective="Hipertrofia, definição muscular e aumento do gasto calórico.",source="treino-feminino-fonte.md",notes="Alongamentos não constam na fonte. Vídeos ainda precisam ser selecionados e conferidos.",workouts=[dict(workoutId=w["id"],order=i+1,label=str(i%4+1) if w["modality"]=="home" else chr(65+i),name=w["name"]) for i,w in enumerate(workouts)])
output=root/"docs/data/treino-feminino-preparado.json"
output.write_text(json.dumps(dict(program=program,workouts=workouts),ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Prepared {len(workouts)} workouts / {sum(len(w['exercises']) for w in workouts)} exercises. No import executed; videos pending.")
