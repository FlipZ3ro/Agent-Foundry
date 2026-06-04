# Overview

## Goal
Menyediakan repo dasar untuk sistem pembuatan SaaS berbasis multi-agent.

## Core flow
1. Ide masuk ke orchestrator
2. Orchestrator pecah jadi task graph
3. Worker mengerjakan task per lane
4. Reviewer cek hasil, konsistensi, dan merge readiness
5. Dashboard/web menampilkan output sistem

## Lanes
- data
- backend
- frontend
- assets
- qa/review
