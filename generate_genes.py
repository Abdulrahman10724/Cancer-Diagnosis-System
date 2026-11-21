"""
Realistic test data generator for Cancer-Diagnosis-System.
Creates data/genes.csv with overlapping classes + label noise,
so the 4 models give DIFFERENT accuracies.

Usage (project root se):
    python generate_genes.py            # 200 genes, seed 42
    python generate_genes.py 500 7      # 500 genes, seed 7
"""
import random, sys, os, shutil

n    = int(sys.argv[1]) if len(sys.argv) > 1 else 200
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 42
random.seed(seed)

path = os.path.join("data", "genes.csv")
if os.path.exists(path) and not os.path.exists(path + ".bak"):
    shutil.copy(path, path + ".bak")          # purana data backup
    print("Backup saved:", path + ".bak")

rows = []
for i in range(1, n + 1):
    label = 1 if random.random() < 0.45 else 0          # ~45% cancerous
    if label == 1:
        # cancerous: mostly high scores, kuch low/medium bhi
        score = random.gauss(0.65, 0.15) if random.random() < 0.85 else random.uniform(0.05, 0.95)
    else:
        # non-cancerous: mostly low scores, kuch high bhi
        score = random.gauss(0.38, 0.15) if random.random() < 0.85 else random.uniform(0.05, 0.95)
    score = min(max(score, 0.01), 0.99)
    if random.random() < 0.08:                           # 8% label noise (real data jaisa)
        label = 1 - label
    rows.append((f"GENE_{i:03d}", round(score, 4), label))

with open(path, "w", newline="") as f:
    f.write("Gene_ID,Mutation_Score,Label\n")
    for g, s, l in rows:
        f.write(f"{g},{s:.4f},{l}\n")

pos = sum(r[2] for r in rows)
print(f"Wrote {n} genes to {path}  (cancerous={pos}, non-cancerous={n-pos}, seed={seed})")