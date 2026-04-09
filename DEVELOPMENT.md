# Development Guide

This document explains the different development modes and how to work with them correctly.

---

## 🔧 Development Modes

This project supports **two development modes**. Understanding the difference is critical for working efficiently.

### 1. 🏠 Local Mode (SQLite)

**Use when:** Working offline or testing without BTP services

```bash
npm run start:dev
```

**Database:** Local `db.sqlite` file  
**Services:** Mock services  
**Profile:** `development` (default)

#### Schema Changes in Local Mode:
```bash
# 1. Make your changes in db/schema.cds
# 2. Deploy to SQLite
npx cds deploy --to sqlite

# 3. Restart the server
# Ctrl+C to stop, then:
npm run start:dev
```

**⚠️ Important:** Local mode REQUIRES running `cds deploy` after schema changes to update the `db.sqlite` file.

---

### 2. ☁️ Hybrid Mode (HANA DB on BTP)

**Use when:** Testing with real BTP services

```bash
npm run start:hybrid
```

**Database:** Remote HANA DB on SAP BTP  
**Services:** Real BTP services  
**Profile:** `hybrid`

#### Schema Changes in Hybrid Mode:
```bash
# 1. Make your changes in db/schema.cds
# 2. Just restart the server (NO deployment needed!)
# Ctrl+C to stop, then:
npm run start:hybrid
```

**✅ Important:** Hybrid mode does NOT need `cds deploy` because:
- CAP reads `schema.cds` at startup
- HANA DB tables already exist in BTP
- The schema change is just for CAP's OData validation layer

---

## 📊 Comparison Table

| Feature | Local Mode (`start:dev`) | Hybrid Mode (`start:hybrid`) |
|---------|-------------------------|------------------------------|
| **Database** | SQLite (`db.sqlite`) | HANA (BTP Cloud) |
| **Services** | Mock/None | Real BTP Services |
| **Schema Changes** | ⚠️ Run `cds deploy` first | ✅ Just restart server |
| **Speed** | Fast | Slower (network latency) |
| **Cost** | Free | Uses BTP credits |

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake #1: Running `cds deploy` in Hybrid Mode
```bash
# DON'T DO THIS in hybrid mode!
npx cds deploy --to sqlite
```

**Why it's wrong:** Hybrid mode uses HANA, not SQLite.

**✅ Correct approach:**
```bash
# Just restart the server
npm run start:hybrid
```

---

### ❌ Mistake #2: Forgetting to Deploy in Local Mode
```bash
# Changes made to db/schema.cds
npm run start:dev  # ❌ Old schema still in db.sqlite!
```

**✅ Correct approach:**
```bash
npx cds deploy --to sqlite  # Update db.sqlite
npm run start:dev            # Now it works!
```

---

## 🎯 Quick Reference

### I changed `db/schema.cds`, what do I do?

**If running Local mode:**
```bash
npx cds deploy --to sqlite
# Then restart: Ctrl+C, npm run start:dev
```

**If running Hybrid mode:**
```bash
# Just restart: Ctrl+C, npm run start:hybrid
```

---

## 📝 Summary

**Golden Rule:**
- **Local Mode = Deploy before restart**
- **Hybrid Mode = Just restart**
