"""Train a tiny on-device muscle/exercise-position classifier from MediaPipe
33-landmark frames. Features are torso-normalized (translate to hip-center,
scale by torso length) so the model is invariant to where the person stands in
frame — the key to generalizing across camera setups. Exports plain weights for
pure-JS inference (no TF.js needed)."""
import csv, json, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

SRC = "/Users/varunkumar/Downloads/dataset_all_points.csv"
# MediaPipe indices (0-based) → CSV is 1-based (x1..x33)
L_SHO, R_SHO, L_HIP, R_HIP = 11, 12, 23, 24

def pt(row, i):  # i is 0-based landmark → columns x{i+1},y{i+1},z{i+1}
    n = i + 1
    return np.array([float(row[f"x{n}"]), float(row[f"y{n}"]), float(row[f"z{n}"])])

def featurize(row):
    pts = np.array([pt(row, i) for i in range(33)])          # (33,3)
    hipc = (pts[L_HIP] + pts[R_HIP]) / 2
    shoc = (pts[L_SHO] + pts[R_SHO]) / 2
    scale = np.linalg.norm((shoc - hipc)[:2]) or 1.0          # torso length (x,y)
    norm = (pts - hipc) / scale                               # translate + scale
    return norm.flatten()                                     # 99 features

X, y = [], []
with open(SRC) as f:
    for row in csv.DictReader(f):
        X.append(featurize(row)); y.append(row["class"])
X = np.array(X); y = np.array(y)
print("samples:", X.shape, "classes:", sorted(set(y)))

Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
scaler = StandardScaler().fit(Xtr)
clf = LogisticRegression(max_iter=2000, C=2.0).fit(scaler.transform(Xtr), ytr)
pred = clf.predict(scaler.transform(Xte))
print("TEST ACCURACY:", round(accuracy_score(yte, pred), 4))
print(classification_report(yte, pred))

model = {
    "classes": list(clf.classes_),
    "mean": scaler.mean_.tolist(),
    "scale": scaler.scale_.tolist(),
    "coef": clf.coef_.tolist(),          # (n_classes, 99)
    "intercept": clf.intercept_.tolist(),
    "feature": "torso-normalized 33x(x,y,z) flattened; hip-center origin, torso-length scale",
}
out = "/Users/varunkumar/minimax@2/varunos/web/src/lib/muscle_model.json"
json.dump(model, open(out, "w"))
print("wrote", out, "bytes:", len(json.dumps(model)))
# also emit two sample feature vectors for the JS test
samples = []
for cls in ("left_bicep", "right_shoulder", "rest"):
    idx = list(y).index(cls)
    samples.append({"class": cls, "features": X[idx].tolist()})
json.dump(samples, open("/tmp/muscle_samples.json", "w"))
print("wrote samples")
