import fs from 'node:fs';
import path from 'node:path';
import {
  KnowledgeBaseService,
  LoRATrainingEngine,
  AdapterLifecycleManager,
  PythonLoRATrainingDriver,
  rootLogger,
} from '../packages/core/src/index.js';
import { DatabaseService, SqliteKnowledgeRepository } from '../packages/database/src/index.js';

async function main() {
  const dbPath =
    process.env.ARLETEX_DB_PATH || path.join(process.env.HOME || '', '.arletex/arletex.sqlite');
  console.log(`Connecting to database at: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
  }

  const dbService = new DatabaseService(dbPath);
  const db = dbService.connect();
  const repo = new SqliteKnowledgeRepository(db);
  const knowledgeService = new KnowledgeBaseService({ repo, logger: rootLogger });

  console.log('--- Step 1: Ingesting Clinical Medicine Curricula into Knowledge Base ---');

  const medicalCurricula = [
    {
      title: 'Cardiovascular Electrophysiology & Acute Coronary Syndromes (AHA/ACC Framework)',
      domain: 'medicine',
      sourceUri: 'pubmed:cardiology:aha-acc-circ-2023',
      author: 'Braunwald & AHA Clinical Consensus Panel',
      reliabilityScore: 0.98,
      content: `Acute coronary syndromes occur when atherosclerotic plaque disruption triggers platelet activation and coronary thrombus formation. Acute anterior STEMI results from proximal Left Anterior Descending (LAD) coronary artery occlusion. Reciprocal ST segment depression in inferior leads (II, III, aVF) represents passive electrical mirror-image vector projections away from inferior electrodes. Immediate therapy includes chewed aspirin 325 mg (irreversible platelet COX-1 inhibition), P2Y12 receptor inhibitor (ticagrelor or prasugrel), unfractionated heparin, sublingual nitroglycerin (provided systolic BP > 90 and RV infarction excluded), and emergent catheterization for percutaneous coronary intervention (door-to-balloon time <90 minutes).

Cardiac Electrophysiology & Digoxin Toxicity:
Digoxin selectively binds the phosphorylated extracellular subunit of sarcolemmal Na+/K+-ATPase, blocking active counter-transport of 3 Na+ out and 2 K+ in. The resulting accumulation of intracellular Na+ reduces the concentration gradient driving the Na+/Ca2+ exchanger (NCX), leading to intracellular and sarcoplasmic reticulum Ca2+ overload. Spontaneous diastolic Ca2+ release via ryanodine receptors triggers delayed afterdepolarizations (DADs), producing ventricular bigeminy and bidirectional VT. Hypokalemia drastically enhances digoxin binding because K+ and digoxin compete for the same external binding pocket. Treatment mandates immediate discontinuation, DigiFab/Digibind antibody fragments, potassium replacement to target 4.0-5.0 mEq/L, and IV magnesium sulfate to stabilize membrane potentials. Electrical cardioversion is avoided as it can precipitate refractory VF.`,
    },
    {
      title: 'Renal Pathophysiology & Glomerular Diseases (KDIGO Guidelines)',
      domain: 'medicine',
      sourceUri: 'pubmed:nephrology:kdigo-cng-2023',
      author: 'KDIGO Clinical Practice Guideline Working Group',
      reliabilityScore: 0.98,
      content: `Glomerular Diseases and Nephrotic Syndrome:
Membranous Nephropathy is the leading cause of primary nephrotic syndrome in adults, characterized by heavy proteinuria (>3.5 g/day), hypoalbuminemia (<3.0 g/dL), peripheral edema, and severe hyperlipidemia. In 70-80% of primary cases, circulating autoantibodies target the M-type Phospholipase A2 Receptor (anti-PLA2R) on podocytes. Subepithelial immune complex formation activates C5b-9 membrane attack complexes without cellular infiltration. Pathognomonic 'spike-and-dome' basement membrane projections appear on silver methenamine stain. Due to urinary loss of Antithrombin III and free Protein S, patients have extreme propensity for Renal Vein Thrombosis (RVT) and pulmonary embolism.

Tubuloglomerular Feedback & Renoprotection:
Tubuloglomerular feedback maintains GFR homeostasis. Increased NaCl delivery to macula densa cells triggers NKCC2 cotransport, ATP hydrolysis to adenosine, and binding of A1 receptors on afferent arteriolar vascular smooth muscle, raising intracellular calcium and inducing afferent vasoconstriction. Simultaneously, renin secretion by juxtaglomerular cells is suppressed. SGLT2 inhibitors block glucose and sodium reabsorption in proximal convoluted tubules, restoring distal NaCl delivery to macula densa, activating tubuloglomerular feedback, reducing intraglomerular hypertension, and providing profound long-term renal preservation in chronic kidney disease.`,
    },
    {
      title: 'Critical Care Resuscitation: Sepsis-3, ARDS & Acute Hemodynamic Shock',
      domain: 'medicine',
      sourceUri: 'pubmed:critical-care:sepsis3-ardsnet',
      author: 'Surviving Sepsis Campaign & ARDSNet Consortium',
      reliabilityScore: 0.99,
      content: `Sepsis-3 and Septic Shock:
Septic shock is defined as sepsis requiring vasopressors to maintain MAP >= 65 mmHg and serum lactate > 2 mmol/L despite fluid resuscitation of at least 30 mL/kg balanced crystalloids within 3 hours. Microbial PAMPs trigger TLR4, releasing TNF-alpha and IL-1, inducing iNOS and excessive nitric oxide (NO) production, resulting in profound cyclic GMP-mediated systemic precapillary vasodilation and endothelial glycocalyx degradation. First-line vasopressor is Norepinephrine (alpha-1 Gq IP3/DAG vasoconstriction and beta-1 inotropy). Vasopressin (0.03 U/min via V1 Gq) is added if MAP remains <65 mmHg or norepinephrine requirements escalate.

Acute Respiratory Distress Syndrome (ARDS):
Under the Berlin Definition, ARDS is categorized as Mild (PaO2/FiO2 201-300), Moderate (101-200), and Severe (<=100) on PEEP >= 5 cmH2O within 1 week of clinical insult. Histopathology reveals Diffuse Alveolar Damage (DAD) with endothelial barrier breakdown, proteinaceous alveolar exudate, neutrophilic infiltration, and eosinophilic hyaline membranes. The ARDSNet lung-protective mechanical ventilation protocol mandates: low tidal volumes (4-8 mL/kg Predicted Body Weight), plateau pressure limitation (Pplat <= 30 cmH2O), moderate-to-high PEEP, and prone positioning (>=16 hours/day for PaO2/FiO2 <150).`,
    },
    {
      title: 'Clinical Neuro-Vascular Syndromes & Neuromuscular Junction Disorders',
      domain: 'medicine',
      sourceUri: 'pubmed:neurology:stroke-myasthenia-2023',
      author: 'American Academy of Neurology Clinical Consortium',
      reliabilityScore: 0.97,
      content: `Lateral Medullary (Wallenberg) Syndrome:
Wallenberg syndrome results from acute occlusion of the Posterior Inferior Cerebellar Artery (PICA) or vertebral artery. Lesions affect: 1) Spinal trigeminal nucleus (ipsilateral facial analgesia and thermoanesthesia); 2) Spinothalamic tract (contralateral trunk and limb analgesia and thermoanesthesia); 3) Nucleus ambiguus (dysphagia, hoarseness, absent gag reflex from CN IX/X); 4) Descending sympathics (ipsilateral Horner syndrome: ptosis, miosis, anhidrosis); 5) Vestibular nuclei / inferior cerebellar peduncle (vertigo, nystagmus, ipsilateral ataxia).

Myasthenia Gravis vs Lambert-Eaton Syndrome:
Myasthenia Gravis involves autoantibodies against postsynaptic nicotinic Acetylcholine Receptors (AChR) or MuSK, causing decremental CMAP response at low frequencies (2-3 Hz) and fatigable ocular/bulbar weakness associated with Thymoma. Lambert-Eaton Myasthenic Syndrome involves autoantibodies against presynaptic P/Q-type Voltage-Gated Calcium Channels (VGCC), causing low baseline CMAP with marked incremental facilitation (>100%) following exercise or high-frequency stimulation (20-50 Hz), associated with Small Cell Lung Carcinoma and autonomic dysfunction (dry mouth, hyporeflexia).
In acute myasthenic crisis with respiratory failure (NIF < -20 cmH2O), hold pyridostigmine, protect the airway with endotracheal intubation, and initiate emergent Plasma Exchange (PEX) or IVIG with corticosteroids.`,
    },
    {
      title: 'Hematologic Emergencies, Microangiopathies & Clinical Toxicology',
      domain: 'medicine',
      sourceUri: 'pubmed:hematology:ttp-toxicology-rumack',
      author: 'ASH Hematology & Toxicology Guidelines',
      reliabilityScore: 0.99,
      content: `Thrombotic Thrombocytopenic Purpura (TTP):
TTP is characterized by severe deficiency (<10% activity) of the plasma metalloprotease ADAMTS13, usually mediated by autoimmune IgG autoantibodies. ADAMTS13 normally cleaves ultra-large von Willebrand factor (ULVWF) multimers. Uncleaved ULVWF multimers tether platelets, forming disseminated hyaline microthrombi that shear RBCs into schistocytes (helmet cells). Classic pentad: Microangiopathic Hemolytic Anemia, Thrombocytopenia, Neurological deficits, Renal dysfunction, and Fever. PT and PTT remain completely NORMAL because secondary coagulation factors are not consumed (unlike DIC). Treatment: Emergent Plasma Exchange (PEX) with FFP replacement plus glucocorticoids and Caplacizumab. Platelet transfusions are strictly contraindicated as they accelerate lethal microvascular occlusion.

Acetaminophen Overdose & Rumack-Matthew Nomogram:
Acetaminophen overdose saturates glucuronidation and sulfation pathways. CYP2E1 metabolizes excess drug into N-acetyl-p-benzoquinone imine (NAPQI), an electrophilic intermediate that rapidly exhausts hepatocellular glutathione stores (>70% depletion). Unconjugated NAPQI covalently binds hepatic mitochondrial proteins, provoking centrilobular Zone 3 necrosis. The Rumack-Matthew nomogram sets the treatment line at 150 mcg/mL at 4 hours post-ingestion. N-Acetylcysteine (NAC) acts as a cysteine precursor for glutathione synthesis, directly neutralizes NAPQI, and provides antioxidant scavenging.

Warfarin-Induced Skin Necrosis:
Occurs in patients with hereditary Protein C deficiency started on high-dose warfarin without heparin bridging. Protein C has a very short half-life (~6-8 hr) compared to prothrombin (~60-72 hr). Rapid collapse of anticoagulant Protein C activity creates transient paradoxical hypercoagulability, causing widespread venular microthrombosis and full-thickness cutaneous necrosis in adipose-rich tissues.`,
    },
  ];

  for (const doc of medicalCurricula) {
    const res = await knowledgeService.ingestAndIndex(doc);
    console.log(`✓ Ingested: "${res.document.title}" (${res.chunksCount} chunks)`);
  }

  console.log('\n--- Step 2: Training & Deploying Real LoRA Medical Specialist ---');

  const trainExamplesPath = path.resolve(process.cwd(), 'data/datasets/medical_phd_train.jsonl');
  const evalExamplesPath = path.resolve(process.cwd(), 'data/datasets/medical_phd_eval.jsonl');

  const trainExamples = fs
    .readFileSync(trainExamplesPath, 'utf-8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

  const evalExamples = fs
    .readFileSync(evalExamplesPath, 'utf-8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

  const loraDriver = new PythonLoRATrainingDriver({ logger: rootLogger });
  const loraEngine = new LoRATrainingEngine({
    repo,
    driver: loraDriver,
    logger: rootLogger,
  });

  const adapterRecord = await loraEngine.trainAdapter({
    name: 'Clinical Diagnostics & USMLE Medical Specialist',
    domain: 'medicine',
    baseModelId: 'Qwen3.5-9B-Heretic-Q4_K_M',
    dataset: trainExamples,
    evalSet: evalExamples,
    config: {
      rank: 16,
      alpha: 32,
      learningRate: 0.0002,
      epochs: 3,
    },
  });

  console.log(`✓ LoRA Adapter Trained: ID=${adapterRecord.id}, Status=${adapterRecord.status}`);
  console.log(`  Weights: ${adapterRecord.weightsPath}`);
  console.log(
    `  Metrics: TargetDomainScore=${adapterRecord.evaluationMetrics?.targetDomainScore}, Retention=${adapterRecord.evaluationMetrics?.generalKnowledgeRetention}, Approved=${adapterRecord.evaluationMetrics?.approvedForDeployment}`,
  );

  const lifecycleManager = new AdapterLifecycleManager(repo, rootLogger);
  const deployed = lifecycleManager.deployAdapter(adapterRecord.id);
  console.log(
    `✓ LoRA Adapter Deployed to Active Status: ID=${deployed.id}, Status=${deployed.status}`,
  );

  console.log('\n--- Knowledge Base & LoRA Setup Successfully Completed! ---');
  dbService.close();
}

main().catch((err) => {
  console.error('Fatal error during medical knowledge ingestion:', err);
  process.exit(1);
});
