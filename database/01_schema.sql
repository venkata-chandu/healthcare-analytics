
CREATE TABLE IF NOT EXISTS patients (
  patient_id VARCHAR(20) PRIMARY KEY,
  age INT NOT NULL,
  gender VARCHAR(20) NOT NULL,
  region VARCHAR(50) NOT NULL,
  insurance_type VARCHAR(50) NOT NULL
);
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id VARCHAR(20) PRIMARY KEY,
  doctor_name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS beds (
  bed_id VARCHAR(20) PRIMARY KEY,
  department VARCHAR(100) NOT NULL,
  bed_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL
);
CREATE TABLE IF NOT EXISTS emergency_visits (
  visit_id VARCHAR(20) PRIMARY KEY,
  patient_id VARCHAR(20) REFERENCES patients(patient_id),
  arrival_datetime TIMESTAMP NOT NULL,
  arrival_date DATE NOT NULL,
  arrival_hour INT NOT NULL,
  day_name VARCHAR(20) NOT NULL,
  triage_level VARCHAR(20) NOT NULL,
  arrival_mode VARCHAR(30) NOT NULL,
  condition VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  waiting_minutes INT NOT NULL,
  treatment_minutes INT NOT NULL,
  admission_flag INT NOT NULL,
  outcome VARCHAR(30) NOT NULL,
  discharge_datetime TIMESTAMP,
  length_of_stay_days NUMERIC(8,2),
  doctor_id VARCHAR(20) REFERENCES doctors(doctor_id),
  treatment_cost NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS bed_utilization (
  snapshot_date DATE NOT NULL,
  department VARCHAR(100) NOT NULL,
  total_beds INT NOT NULL,
  occupied_beds INT NOT NULL,
  available_beds INT NOT NULL,
  PRIMARY KEY(snapshot_date, department)
);
CREATE INDEX IF NOT EXISTS idx_emergency_arrival_date ON emergency_visits(arrival_date);
CREATE INDEX IF NOT EXISTS idx_emergency_department ON emergency_visits(department);
CREATE INDEX IF NOT EXISTS idx_bed_snapshot ON bed_utilization(snapshot_date);
