import os
import sys
import time
import json
import random
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

NVIDIA_API_KEYS = [
    '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',
    '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',
    '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',
    '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',
    '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'
]

NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
MODEL_NAME = 'meta/llama-3.2-11b-vision-instruct'

REELS_DB_FILE = "/home/ubuntu/medmacs_discover_data/reels_db.json"
MEDIA_DIR = "/home/ubuntu/medmacs_discover_data/media"

os.makedirs(MEDIA_DIR, exist_ok=True)
db_lock = Lock()
key_index_lock = Lock()
current_key_idx = 0

def get_next_nvidia_key():
    global current_key_idx
    with key_index_lock:
        key = NVIDIA_API_KEYS[current_key_idx % len(NVIDIA_API_KEYS)]
        current_key_idx += 1
        return key

def refine_topic_name(topic_raw):
    clean = re.sub(r'\s*\([^)]*\)', '', topic_raw)
    clean = re.sub(r'\b(ICD-\d+|CDC|PHIL|USA|UK|WHO|[A-Z]{2,3}-\d+)\b', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'^\d+\s*[-.]?\s*', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

MBBS_TOPICS = [
    ("Myocardial Infarction", ["https://upload.wikimedia.org/wikipedia/commons/e/eb/Infarction.jpg", "https://upload.wikimedia.org/wikipedia/commons/a/a8/Anterior_MI.jpg"], 4, "Cardiology"),
    ("Aortic Dissection", ["https://upload.wikimedia.org/wikipedia/commons/8/8e/Aortic_Dissection_CT.jpg", "https://upload.wikimedia.org/wikipedia/commons/9/9f/Stanford_Type_A_Dissection.jpg"], 4, "Cardiology"),
    ("Mitral Valve Prolapse", ["https://upload.wikimedia.org/wikipedia/commons/b/b5/Mitral_valve_prolapse.jpg", "https://upload.wikimedia.org/wikipedia/commons/7/77/MVP_echo.jpg"], 4, "Cardiology"),
    ("Infective Endocarditis", ["https://upload.wikimedia.org/wikipedia/commons/a/a1/Infective_Endocarditis_Vegetation.jpg", "https://upload.wikimedia.org/wikipedia/commons/8/87/Endocarditis_Osler_Node.jpg"], 4, "Cardiology"),
    ("Pericardial Effusion", ["https://upload.wikimedia.org/wikipedia/commons/5/52/Pericardial_effusion_ultrasound.jpg", "https://upload.wikimedia.org/wikipedia/commons/c/c5/Cardiac_tamponade_echo.jpg"], 4, "Cardiology"),
    ("Deep Vein Thrombosis", ["https://upload.wikimedia.org/wikipedia/commons/b/b3/DVT_doppler_ultrasound.jpg", "https://upload.wikimedia.org/wikipedia/commons/4/4b/Phlegmasia_cerulea_dolens.jpg"], 3, "Vascular Surgery"),
    ("Temporal Arteritis", ["https://upload.wikimedia.org/wikipedia/commons/0/06/Temporal_arteritis_biopsy.jpg", "https://upload.wikimedia.org/wikipedia/commons/d/d7/Temporal_artery_biopsy_histopathology.jpg"], 4, "Rheumatology"),
    ("Pneumothorax", ["https://upload.wikimedia.org/wikipedia/commons/7/77/Pneumothorax_xray.jpg", "https://upload.wikimedia.org/wikipedia/commons/d/df/Pneumothorax01.jpg"], 3, "Pulmonology"),
    ("Pulmonary Tuberculosis", ["https://upload.wikimedia.org/wikipedia/commons/6/6c/Tuberculosis_chest_xray.jpg", "https://upload.wikimedia.org/wikipedia/commons/7/72/TB_cavitation_chest_xray.jpg"], 3, "Pulmonology"),
    ("Sarcoidosis", ["https://upload.wikimedia.org/wikipedia/commons/8/8e/Sarcoidosis_CT_hilar.jpg", "https://upload.wikimedia.org/wikipedia/commons/0/05/Sarcoidosis_noncaseating_granuloma.jpg"], 4, "Pulmonology"),
    ("Acute Appendicitis", ["https://upload.wikimedia.org/wikipedia/commons/3/36/Appendicitis_ultrasound.png", "https://upload.wikimedia.org/wikipedia/commons/c/c8/Acute_appendicitis_CT.jpg"], 3, "General Surgery"),
    ("Liver Cirrhosis", ["https://upload.wikimedia.org/wikipedia/commons/5/58/Cirrhosis_liver_ultrasound.jpg", "https://upload.wikimedia.org/wikipedia/commons/f/f7/Cirrhosis_histology_micrograph.jpg"], 4, "Gastroenterology"),
    ("Acute Pancreatitis", ["https://upload.wikimedia.org/wikipedia/commons/3/39/Acute_pancreatitis_CT.jpg", "https://upload.wikimedia.org/wikipedia/commons/a/a2/Pancreatitis_Balthazar_CT.jpg"], 4, "Gastroenterology"),
    ("Cholecystitis", ["https://upload.wikimedia.org/wikipedia/commons/5/5e/Gallstone_cholecystitis_ultrasound.jpg", "https://upload.wikimedia.org/wikipedia/commons/b/b7/Acute_cholecystitis_ultrasound.jpg"], 3, "General Surgery"),
    ("Renal Calculi", ["https://upload.wikimedia.org/wikipedia/commons/9/91/Kidney_stone_CT.jpg", "https://upload.wikimedia.org/wikipedia/commons/1/14/Renal_calculus_radiograph.jpg"], 4, "Urology"),
    ("Subarachnoid Hemorrhage", ["https://upload.wikimedia.org/wikipedia/commons/0/07/Subarachnoid_hemorrhage_CT.jpg", "https://upload.wikimedia.org/wikipedia/commons/6/69/SAH_CT_brain.jpg"], 5, "Neurosurgery"),
    ("Multiple Sclerosis", ["https://upload.wikimedia.org/wikipedia/commons/8/87/Multiple_sclerosis_brain_MRI.jpg", "https://upload.wikimedia.org/wikipedia/commons/b/b2/MS_Dawson_fingers_MRI.jpg"], 5, "Neurology"),
    ("Glioblastoma Multiforme", ["https://upload.wikimedia.org/wikipedia/commons/1/19/Glioblastoma_MRI.jpg", "https://upload.wikimedia.org/wikipedia/commons/4/4d/Glioblastoma_multiforme_histology.jpg"], 5, "Neurosurgery"),
    ("Plaque Psoriasis", ["https://upload.wikimedia.org/wikipedia/commons/d/d6/Psoriasis_on_back.jpg", "https://upload.wikimedia.org/wikipedia/commons/0/08/Psoriasis_plaque_clinical.jpg"], 4, "Dermatology"),
    ("Melanoma", ["https://upload.wikimedia.org/wikipedia/commons/6/6c/Melanoma.jpg", "https://upload.wikimedia.org/wikipedia/commons/3/37/Cutaneous_melanoma_dermoscopy.jpg"], 5, "Dermatology"),
    ("Systemic Lupus Erythematosus", ["https://upload.wikimedia.org/wikipedia/commons/8/86/Lupus_malar_rash.jpg", "https://upload.wikimedia.org/wikipedia/commons/4/4e/Malar_rash_lupus.jpg"], 4, "Rheumatology"),
    ("Osteosarcoma", ["https://upload.wikimedia.org/wikipedia/commons/5/52/Osteosarcoma_xray.jpg", "https://upload.wikimedia.org/wikipedia/commons/9/93/Osteosarcoma_Sunburst_pattern_xray.jpg"], 4, "Orthopedics"),
    ("Iron Deficiency Anemia", ["https://upload.wikimedia.org/wikipedia/commons/7/75/Iron_deficiency_anemia_blood_smear.jpg", "https://upload.wikimedia.org/wikipedia/commons/b/b2/Microcytic_hypochromic_RBCs.jpg"], 3, "Hematology"),
    ("Sickle Cell Anemia", ["https://upload.wikimedia.org/wikipedia/commons/d/df/Sickle_cells_smear.jpg", "https://upload.wikimedia.org/wikipedia/commons/3/36/Sickle_cell_blood_smear.jpg"], 3, "Hematology"),
    ("Ectopic Pregnancy", ["https://upload.wikimedia.org/wikipedia/commons/c/c7/Ectopic_pregnancy_ultrasound.jpg", "https://upload.wikimedia.org/wikipedia/commons/2/23/Tubal_ectopic_pregnancy_US.jpg"], 4, "Obstetrics & Gynecology")
]

def search_medmacs_rag(query_text):
    try:
        url = f"http://127.0.0.1:8001/search?q={urllib.parse.quote(query_text)}&limit=2"
        req = urllib.request.Request(url, headers={'User-Agent': 'MedmacsBot/2.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=3).read().decode('utf-8'))
        results = res.get('results', [])
        snippets = [r.get('content', '') for r in results]
        return "\n".join(snippets)
    except Exception:
        return ""

def call_nemotron_llm(prompt_text):
    for attempt in range(3):
        key = get_next_nvidia_key()
        req = urllib.request.Request(
            NVIDIA_URL,
            data=json.dumps({
                'model': MODEL_NAME,
                'messages': [{'role': 'user', 'content': prompt_text}],
                'temperature': 0.3,
                'max_tokens': 500
            }).encode('utf-8'),
            headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
        )
        try:
            res = urllib.request.urlopen(req, timeout=8)
            text = json.loads(res.read().decode('utf-8'))['choices'][0]['message']['content']
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            time.sleep(0.3)
    return None

def sanitize_question_text(q_text, topic):
    q_clean = re.sub(r'^(A\s+\d+[- ]year[- ]old\s+(male|female|patient)\s+presents?\s+with\s+[^.!?]*[.!?]\s*)', '', q_text, flags=re.IGNORECASE)
    q_clean = re.sub(r'^(A\s+patient\s+presents?\s+with\s+[^.!?]*[.!?]\s*)', '', q_clean, flags=re.IGNORECASE)
    
    if "what is the correct diagnosis" in q_clean.lower() or "what is the diagnosis" in q_clean.lower() or not q_clean:
        q_clean = f"Which pathognomonic finding or diagnostic investigation is most characteristic of {topic}?"
        
    return q_clean.strip()

def sanitize_option_text(opt_text):
    opt_clean = re.sub(r'\s*\([^)]*\)', '', str(opt_text))
    words = opt_clean.strip().split()
    if len(words) > 6:
        opt_clean = " ".join(words[:6])
    return opt_clean.strip()

def generate_single_reel(topic_tuple):
    topic_raw, img_urls, year, subject = topic_tuple
    topic = refine_topic_name(topic_raw)
    
    img_url = random.choice(img_urls)
    assigned_id = f"MED-DISCOVER-{random.randint(1000000, 9999999)}"
    local_file = f"{assigned_id}.webp"
    local_path = os.path.join(MEDIA_DIR, local_file)
    
    try:
        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'MedmacsBot/2.0'})
        img_bytes = urllib.request.urlopen(img_req, timeout=6).read()
        with open(local_path, "wb") as f:
            f.write(img_bytes)
    except Exception:
        return None
        
    rag_context = search_medmacs_rag(topic)
    target_option = random.choice(["A", "B"])
    
    prompt = f"""
    Act as an elite Medical Board Examiner creating a High-Yield MBBS Year {year} ({subject}) question.
    Topic: {topic}
    RAG Textbook Context: {rag_context[:400]}

    STRICT DIRECTIVES:
    1. REFINED TOPIC: Topic name is "{topic}".
    2. NO CASE / NO VIGNETTE QUESTIONS: Do NOT write case scenarios or patient stories (Do NOT use "A patient presents...", "A 45-year-old male...", "A female with...").
    3. HIGH-YIELD GENERIC QUESTION: Write a direct, high-yield board question assessing the key diagnostic, pathological, or therapeutic aspect of {topic}.
    4. PURE UNIQUE LLM GENERATION: Generate a unique, natural question stem dynamically for {topic}. Do NOT use formulaic pattern phrases like "What is the correct diagnosis of".
    5. SMALL & BALANCED OPTIONS: Write 2 concise, short options (1-4 words per option). NO parentheses inside options.
    6. TARGET CORRECT ANSWER: MUST be Option '{target_option}'.

    Return ONLY a single JSON object with exact keys:
    {{
        "identification": "1 short sentence explaining key visual diagnostic finding for {topic}",
        "diagnosis": "{topic}",
        "question": "direct high-yield board question for {topic} without case scenario or vignette",
        "option_a": "concise short option A (1-4 words without parentheses)",
        "option_b": "concise short option B (1-4 words without parentheses)",
        "correct_option": "{target_option}",
        "explanation": "2 sentence high-yield explanation from board guidelines"
    }}
    """
    
    ai_res = call_nemotron_llm(prompt)
    if not ai_res or not ai_res.get('question') or not ai_res.get('option_a') or not ai_res.get('option_b'):
        return None
        
    q_text = sanitize_question_text(ai_res.get('question', ''), topic)
    opt_a = sanitize_option_text(ai_res.get('option_a', ''))
    opt_b = sanitize_option_text(ai_res.get('option_b', ''))
    
    if not opt_a or not opt_b:
        return None
        
    reel = {
        "assigned_id": assigned_id,
        "medical_topic": topic,
        "mbbs_year": year,
        "subject": subject,
        "media_category": "Clinical Image / Radiograph",
        "identification_text": ai_res.get("identification", f"Clinical presentation of {topic}"),
        "diagnosis_text": topic,
        "management_text": ai_res.get("explanation", "")[:150],
        "treatment_text": ai_res.get("explanation", "")[:150],
        "interactive_quiz": {
            "question": q_text,
            "option_a": opt_a,
            "option_b": opt_b,
            "correct_option": str(ai_res.get("correct_option", target_option)).upper()[0],
            "explanation": ai_res.get("explanation", "")
        },
        "image_url": f"/media/{local_file}",
        "original_source_url": img_url,
        "license_type": "Creative Commons Open Access",
        "attribution_text": f"Wikimedia Medical Commons",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "last_fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "fetch_count": 0
    }
    
    with db_lock:
        if os.path.exists(REELS_DB_FILE):
            with open(REELS_DB_FILE, "r") as f:
                reels_list = json.load(f)
        else:
            reels_list = []
            
        reels_list.append(reel)
        with open(REELS_DB_FILE, "w") as f:
            json.dump(reels_list, f, indent=2)
            
    print(f"⚡ [RAPID SUCCESS] Reel {assigned_id} for {topic} (Correct: {target_option}). Total DB: {len(reels_list)}", flush=True)
    return reel

def run_continuous_batch_generation(target_count=20000):
    print(f"🚀 Starting High-Speed Direct-URL Generator (Target: {target_count} Reels)...", flush=True)
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        while True:
            with db_lock:
                if os.path.exists(REELS_DB_FILE):
                    current_count = len(json.load(open(REELS_DB_FILE)))
                else:
                    current_count = 0
                    
            if current_count >= target_count:
                print(f"🎉 Target count of {target_count} reels reached!", flush=True)
                break
                
            tasks = []
            for _ in range(40):
                topic = random.choice(MBBS_TOPICS)
                tasks.append(executor.submit(generate_single_reel, topic))
                
            for future in as_completed(tasks):
                res = future.result()
                
            time.sleep(0.1)

if __name__ == "__main__":
    run_continuous_batch_generation(20000)
