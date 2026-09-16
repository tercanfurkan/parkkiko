idea:
Parkability\* — point your phone at the street and the curb ahead is painted green, red, or grey. The trick is that the camera isn't reading the pavement: legality isn't visible, because it depends on the hour, the day, the permit zone, and a sign you may have already walked past. The camera only establishes where you're standing and which way you face; the verdict comes from a rules database keyed to place, curb side, and time — built from Helsinki's open parking data and the 68,000 city traffic signs that street maintainers are required by law to publish. Grey is a first-class answer, not a failure: the app colours a curb green only when it actually knows, because a wrong green costs the user a fine and costs us their trust, while an honest "unsure" costs nothing. It never claims to grant permission — it shows you the rule, and the sign it came from.

thoughs of notebookml-agent:
**Parkability** is an exceptionally clever, product-minded concept. Its emphasis on honest uncertainty ("Grey is a first-class answer") shows a mature understanding of trust in user-facing data science.

Here is a short evaluation against the **DATA11001** criteria and the **Spatiotemporal Data Analysis (SDA)** research group focus:

---

### **1. The Strengths**

- **Incredible Spatial Data Wrangling:** Ingesting Helsinki's 68,000 traffic sign records alongside parking zone geometries requires serious "sweat and tears"—parsing messy time-restriction strings, spatial indexing, and aligning curb segments.
- **Real Added Value:** Solves a genuine urban friction point without over-promising or creating legal liability.

---

### **2. The Course Risk & The "ML Gap"**

- **The Trap:** If the app simply matches camera orientation + GPS to a database query of known rules, the TAs will flag it as a **GIS/software engineering app, not a machine learning project**.
- **The Fix (Defining the ML Task):** Frame the learning task around **Spatial Uncertainty Prediction**:
  - **Option A (Uncertainty Classification):** Train a classifier (e.g., Random Forest/Logistic Regression) to predict _Curb Rule Confidence_ (Green vs. Grey) based on GPS accuracy radius, distance to nearest sign, and time-window complexity.
  - **Option B (Sign Rule Parsing):** Use NLP/classification on unstructured municipal sign metadata to automatically categorize complex Finnish parking condition strings into machine-readable rule vectors.

---

### **3. SDA Research Group Connection**

This idea bridges directly to Professor Laura Ruotsalainen’s group pillars:

- **Visual Perception & Localization:** Aligning camera pose with urban spatial data in "city canyons" where GPS drifts.
- **Uncertainty-Aware Learning:** Modeling spatial confidence intervals so the system knows when it is "unsure".

---

🚗 **Nudge:** Would you like me to draft a 1-page Machine Learning Canvas for **Parkability** showing how to frame the camera pose + rule engine into a complete, graded course project?
