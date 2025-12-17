# Foundation (Cherry) - Product Requirements Document

## 1. Product Overview
**Foundation (Cherry)** is a habit discipline app designed to help builders and ADHD users maintain meaningful habits over years—not days—by combining:
- A frictionless daily habit loop.
- Emotionally grounded streak mechanics.
- Permanent visualization of lifetime effort.
- A calm, disciplined AI companion.

The product prioritizes **execution over planning**, **permanence over perfection**, and **depth over breadth**.

## 2. Target Audience
**Primary Users**: Builders, founders, makers, and ADHD users seeking structure without overwhelm.

**User Needs**:
- Simple daily interaction (< 60 seconds).
- Clear feedback loops.
- Emotional safety after missed days.
- Proof that effort compounds over time.

## 3. Core Product Pillars
1.  **Habits First**.
2.  **Streaks Must Feel Earned**.
3.  **Nothing You Earn Disappears** (Permanence).
4.  **AI as a Disciplined Mirror**.
5.  **Daily Use < 60 Seconds**.

## 4. App Structure & Navigation
**Tabs**:
1.  **Foundation** (Primary)
2.  **Stats** (Lifetime visualization)
3.  **Settings**

*Note: Reflection is optional and secondary, not a primary tab.*

## 5. Core Features

### 5.1. Foundation Tab (Primary Experience)
The user spends the majority of their time here.

#### 5.1.1. Daily Intention
- One short AI-generated sentence per day.
- Generated ahead of time.
- Calm, grounded, encouraging tone.
- Positioned at the top of the screen to anchor the day.

#### 5.1.2. Habit Bubbles
Primary interaction surface. Each habit is a tappable bubble.
- **Visual States**:
    - **Incomplete**: Neutral, soft.
    - **Completed**: Firm, satisfying.
    - **Gold Day Eligible**: Subtle anticipation cues.
    - **Gold Day Complete**: Warm gold tone.
- **Interaction**:
    - Tap to complete (with micro-animations/physics).
    - Undo supported.
- **Long Press**: Shows current streak, last missed date, next milestone.

#### 5.1.3. Gold Streaks
- Earned by completing **all** scheduled habits for the day.
- Completion triggers a subtle screen shift, one-line AI message, and Cherry reward.
- Gold streaks represent **current discipline**.

### 5.2. Habit Scheduling System
- **Scheduling Model**:
    - Select explicit days of the week (Mon–Sun).
    - Times per day (1–3).
- **Behavior**:
    - Habits **only** appear on scheduled days.
    - Streaks **only** increment or break on scheduled days.
    - Non-scheduled days do not affect streaks (removes false failures).

### 5.3. Cherries (Points System)
- **Earned for**: Completing habits, Gold Streaks, Milestones.
- **Philosophy**: Never spent, never removed. Represents lifetime effort.

### 5.4. Stats Tab (Lifetime Visualization)
Reframes progress from streaks to **permanence**.

#### 5.4.1. Lifetime Cherry Pyramid (Hero Feature)
- **Core Concept**: Total cherries visualized as a 3D cherry pile/pyramid.
- **Behavior**:
    - Cherries "fall in" only when earned.
    - Once settled, they remain permanently.
    - **Technical**: Uses Three.js/WebGL. Tiered representation (not 1:1 for massive numbers) but always strictly monotonic.
- **Meaning**: Represents all work done. Independent of streaks.

#### 5.4.2. Supporting Stats
- Total cherries (number).
- Current Gold Streak.
- Longest Gold Streak.
- Total habits completed.
- Days active.

#### 5.4.3. AI Stats Interpretation
- Users can ask natural language questions (e.g., "What habit matters most?").
- AI responses are concise and grounded.

### 5.5. Reflection (Optional)
- Accessible features: Free-text journal, Mood selection, Optional AI question.
- **Reward**: Reduced frequency rewards to encourage depth without fatigue.

## 6. AI Persona & Behavior
- **Personality**: Calm, Proud, Disciplined, Supportive but not soft.
- **Role**: Motivational best friend / Disciplined mirror.
- **Behavior**:
    - Does **not** nag or interrupt flow.
    - Provides "Fortune cookie style" concise wisdom.

## 7. Technical Architecture Updates
- **Stack**: Next.js, Supabase, TailwindCSS, OpenAI.
- **New Dependency**: `three`, `@react-three/fiber`, `@react-three/drei` for the Cherry Pyramid.
- **Database Schema Changes**:
    - `foundations`: Add `days_of_week` (JSON/Array), `times_per_day` (Int).
    - `profiles`: Ensure `total_cherries` is robust.
- **Engineering Spec (Pyramid)**:
    - Use InstancedMesh for performance.
    - Logic to handle "catching up" (fast-forward) vs "real-time drop".

## 8. Success Metrics
- Day 1 → Day 7 retention.
- 30-day habit continuity.
- Gold streak frequency.
- Average daily session length (< 90 seconds).
