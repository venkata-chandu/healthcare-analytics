const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "healthcare",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres"
});

const allowed = {
  gender: ["Male", "Female", "Other"],
  insurance: ["Private Insurance", "Government Scheme", "Self Pay"],
  triage: ["Critical", "High", "Moderate", "Low"],
  arrival: ["Walk-in", "Ambulance", "Referral"],
  departments: ["Emergency", "ICU", "General Medicine", "Cardiology", "Orthopedics", "Pediatrics"],
  conditions: ["Chest Pain", "Accident/Trauma", "Breathing Difficulty", "Fever/Infection", "Abdominal Pain", "Fracture", "Pediatric Fever", "Stroke Symptoms", "Allergic Reaction", "Severe Headache", "Asthma Attack", "Diabetes Complication", "Hypertensive Crisis", "Burn Injury"],
  outcomes: ["Discharged", "Admitted", "Observation", "Transferred"]
};

const clean = value => typeof value === "string" ? value.trim() : value;
const localTimestamp = value => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const validIn = (value, list) => list.includes(value);
const positiveInt = value => Number.isInteger(Number(value)) && Number(value) >= 0;

app.get("/api/health", async (_req,res)=>{
  try { await pool.query("SELECT 1"); res.json({ok:true, service:"api", database:"connected"}); }
  catch(e){ res.status(500).json({ok:false,error:e.message}); }
});

app.get("/api/dashboard/summary", async (_req,res)=>{
  try {
    const q = `
      SELECT
        (SELECT COUNT(*) FROM patients)::int AS total_patients,
        COUNT(*) FILTER (WHERE triage_level='Critical')::int AS critical_cases,
        COUNT(*) FILTER (WHERE admission_flag=1)::int AS admissions,
        ROUND(AVG(waiting_minutes),1) AS avg_wait_minutes,
        ROUND(AVG(length_of_stay_days),2) AS avg_los_days,
        ROUND(AVG(treatment_cost),2) AS avg_treatment_cost
      FROM emergency_visits`;
    const {rows}=await pool.query(q);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Create a patient + initial emergency visit. Existing behavior retained for compatibility.
app.post("/api/patients", async (req,res)=>{
  const client=await pool.connect();
  try {
    const {
      patient_id, age, gender, region, insurance_type,
      triage_level, arrival_mode, condition, department
    }=req.body;
    if(!patient_id || !positiveInt(age) || Number(age) < 1 || Number(age) > 120 || !gender || !triage_level || !condition || !department)
      return res.status(400).json({error:"Valid patient_id, age (1-120), gender, triage_level, condition and department are required"});
    if(!validIn(gender,allowed.gender) || !validIn(triage_level,allowed.triage) || !validIn(arrival_mode || "Walk-in",allowed.arrival) || !validIn(department,allowed.departments) || !validIn(condition,allowed.conditions))
      return res.status(400).json({error:"One or more selected values are invalid"});

    const exists=await client.query("SELECT 1 FROM patients WHERE patient_id=$1",[clean(patient_id)]);
    if(exists.rowCount) return res.status(409).json({error:"Patient ID already exists. Use Patient Management to edit the existing patient or create a new emergency visit."});

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO patients(patient_id,age,gender,region,insurance_type)
       VALUES($1,$2,$3,$4,$5)`,
      [clean(patient_id),Number(age),gender,region||"Central Zone",insurance_type||"Self Pay"]);
    const doctor=await client.query(
      `SELECT doctor_id FROM doctors WHERE department=$1 ORDER BY random() LIMIT 1`,[department]);
    const doctorId=doctor.rows[0]?.doctor_id || null;
    const visitId="EV"+Date.now().toString().slice(-9);
    const arrival=new Date();
    const wait=triage_level==="Critical"?5:triage_level==="High"?15:triage_level==="Moderate"?30:45;
    await client.query(
      `INSERT INTO emergency_visits
       (visit_id,patient_id,arrival_datetime,arrival_date,arrival_hour,day_name,
        triage_level,arrival_mode,condition,department,waiting_minutes,treatment_minutes,
        admission_flag,outcome,discharge_datetime,length_of_stay_days,doctor_id,treatment_cost)
       VALUES($1,$2,$3::timestamp,$3::date,EXTRACT(HOUR FROM $3::timestamp)::int,
        TO_CHAR($3::timestamp,'Day'),$4,$5,$6,$7,$8,0,0,'Observation',NULL,0,$9,0)`,
      [visitId,clean(patient_id),localTimestamp(arrival),triage_level,
       arrival_mode||"Walk-in",condition,department,wait,doctorId]);
    await client.query("COMMIT");
    res.status(201).json({message:"Emergency visit created",visit_id:visitId,arrival_datetime:arrival});
  } catch(e) {
    await client.query("ROLLBACK");
    res.status(500).json({error:e.message});
  } finally { client.release(); }
});

// Patient management -------------------------------------------------------
app.get("/api/patients", async (req,res)=>{
  try {
    const search=clean(req.query.search || "");
    const {rows}=await pool.query(`
      SELECT p.patient_id,p.age,p.gender,p.region,p.insurance_type,
             COUNT(ev.visit_id)::int AS visit_count,
             MAX(ev.arrival_datetime) AS last_visit
      FROM patients p
      LEFT JOIN emergency_visits ev ON ev.patient_id=p.patient_id
      WHERE ($1='' OR p.patient_id ILIKE '%'||$1||'%' OR p.region ILIKE '%'||$1||'%')
      GROUP BY p.patient_id,p.age,p.gender,p.region,p.insurance_type
      ORDER BY p.patient_id
      LIMIT 100`,[search]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.put("/api/patients/:id", async (req,res)=>{
  try {
    const id=clean(req.params.id);
    const {age,gender,region,insurance_type}=req.body;
    if(!positiveInt(age) || Number(age)<1 || Number(age)>120) return res.status(400).json({error:"Age must be between 1 and 120"});
    if(!validIn(gender,allowed.gender)) return res.status(400).json({error:"Invalid gender"});
    if(!region || !validIn(insurance_type,allowed.insurance)) return res.status(400).json({error:"Region and valid insurance type are required"});
    const {rows}=await pool.query(`
      UPDATE patients SET age=$1,gender=$2,region=$3,insurance_type=$4
      WHERE patient_id=$5
      RETURNING patient_id,age,gender,region,insurance_type`,
      [Number(age),gender,clean(region),insurance_type,id]);
    if(!rows.length) return res.status(404).json({error:"Patient not found"});
    res.json({message:"Patient updated",patient:rows[0]});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Emergency visit management ----------------------------------------------
app.get("/api/visits", async (req,res)=>{
  try {
    const search=clean(req.query.search || "");
    const {rows}=await pool.query(`
      SELECT ev.visit_id,ev.patient_id,p.age,p.gender,ev.arrival_datetime,
             ev.triage_level,ev.arrival_mode,ev.condition,ev.department,
             ev.waiting_minutes,ev.treatment_minutes,ev.admission_flag,
             ev.outcome,ev.discharge_datetime,ev.length_of_stay_days,
             ev.doctor_id,d.doctor_name,ev.treatment_cost
      FROM emergency_visits ev
      LEFT JOIN patients p ON p.patient_id=ev.patient_id
      LEFT JOIN doctors d ON d.doctor_id=ev.doctor_id
      WHERE ($1='' OR ev.visit_id ILIKE '%'||$1||'%' OR ev.patient_id ILIKE '%'||$1||'%' OR ev.condition ILIKE '%'||$1||'%')
      ORDER BY ev.arrival_datetime DESC
      LIMIT 100`,[search]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get("/api/visits/recent", async (_req,res)=>{
  try {
    const {rows}=await pool.query(`
      SELECT visit_id, patient_id, arrival_datetime, triage_level, condition, department
      FROM emergency_visits ORDER BY arrival_datetime DESC LIMIT 10`);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.put("/api/visits/:id", async (req,res)=>{
  try {
    const id=clean(req.params.id);
    const {
      arrival_datetime,triage_level,arrival_mode,condition,department,
      waiting_minutes,treatment_minutes,admission_flag,outcome,
      discharge_datetime,length_of_stay_days,doctor_id,treatment_cost
    }=req.body;
    const arrival=new Date(arrival_datetime);
    if(Number.isNaN(arrival.getTime())) return res.status(400).json({error:"Invalid arrival date/time"});
    if(!validIn(triage_level,allowed.triage) || !validIn(arrival_mode,allowed.arrival) || !validIn(condition,allowed.conditions) || !validIn(department,allowed.departments))
      return res.status(400).json({error:"One or more emergency values are invalid"});
    if(!positiveInt(waiting_minutes) || !positiveInt(treatment_minutes) || ![0,1].includes(Number(admission_flag)) || !validIn(outcome,allowed.outcomes))
      return res.status(400).json({error:"Waiting/treatment must be non-negative, admission must be 0 or 1, and outcome must be valid"});
    if(length_of_stay_days !== null && length_of_stay_days !== "" && Number(length_of_stay_days)<0) return res.status(400).json({error:"Length of stay cannot be negative"});
    if(treatment_cost !== null && treatment_cost !== "" && Number(treatment_cost)<0) return res.status(400).json({error:"Treatment cost cannot be negative"});

    const doctor=doctor_id ? await pool.query("SELECT doctor_id FROM doctors WHERE doctor_id=$1",[doctor_id]) : {rowCount:0};
    if(doctor_id && !doctor.rowCount) return res.status(400).json({error:"Selected doctor does not exist"});

    const {rows}=await pool.query(`
      UPDATE emergency_visits SET
        arrival_datetime=$1::timestamp,
        arrival_date=$1::date,
        arrival_hour=EXTRACT(HOUR FROM $1::timestamp)::int,
        day_name=TO_CHAR($1::timestamp,'Day'),
        triage_level=$2,arrival_mode=$3,condition=$4,department=$5,
        waiting_minutes=$6,treatment_minutes=$7,admission_flag=$8,outcome=$9,
        discharge_datetime=$10::timestamp,length_of_stay_days=$11,
        doctor_id=$12,treatment_cost=$13
      WHERE visit_id=$14
      RETURNING visit_id,patient_id,arrival_datetime,triage_level,arrival_mode,condition,department,
                waiting_minutes,treatment_minutes,admission_flag,outcome,discharge_datetime,
                length_of_stay_days,doctor_id,treatment_cost`,
      [localTimestamp(arrival),triage_level,arrival_mode,condition,department,
       Number(waiting_minutes),Number(treatment_minutes),Number(admission_flag),outcome,
       discharge_datetime ? localTimestamp(discharge_datetime) : null,
       length_of_stay_days===""||length_of_stay_days==null?null:Number(length_of_stay_days),
       doctor_id||null,treatment_cost===""||treatment_cost==null?0:Number(treatment_cost),id]);
    if(!rows.length) return res.status(404).json({error:"Emergency visit not found"});
    res.json({message:"Emergency visit updated",visit:rows[0]});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.listen(4000,()=>console.log("Healthcare API running on http://localhost:4000"));
