"""
Posture Analysis Service - Analyzes form quality and provides feedback
"""
import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.posture import PostureSession
from app.models.posture_analysis import PostureAnalysis
from app.schemas.posture_analysis import PostureSessionAnalysisCreate, PostureSessionAnalysisResponse


# Issue severity mapping with recovery advice
FORM_ISSUES_DATABASE = {
    "back_rounding": {
        "severity": "high",
        "description": "Your back is rounding instead of staying neutral",
        "advice": "Keep your spine straight. Engage your core and maintain neutral spine throughout the movement."
    },
    "elbows_flaring": {
        "severity": "medium",
        "description": "Elbows are flaring out too much",
        "advice": "Keep elbows closer to your body. Adjust your arm position and reduce the range if needed."
    },
    "uneven_balance": {
        "severity": "medium",
        "description": "Weight is unevenly distributed",
        "advice": "Ensure even weight distribution on both sides. Practice with lighter weight to build symmetry."
    },
    "incomplete_range": {
        "severity": "low",
        "description": "Not achieving full range of motion",
        "advice": "Move through the complete range while maintaining control. Start lighter if needed."
    },
    "momentum_use": {
        "severity": "high",
        "description": "Using momentum instead of controlled movement",
        "advice": "Slow down and focus on controlled movements. Use less weight if necessary."
    },
    "neck_strain": {
        "severity": "high",
        "description": "Neck is strained or misaligned",
        "advice": "Keep your head neutral and aligned with your spine. Avoid looking up or down."
    },
    "knee_collapse": {
        "severity": "high",
        "description": "Knees are caving inward",
        "advice": "Push your knees outward throughout the movement. Strengthen hip abductors."
    },
    "depth_inconsistency": {
        "severity": "medium",
        "description": "Inconsistent depth between reps",
        "advice": "Focus on achieving the same depth on each rep. Practice with a mirror or lower weight."
    }
}

# Improvement tips based on issues
IMPROVEMENT_TIPS = {
    "high_issues": [
        "Film yourself to check form before continuing",
        "Reduce weight by 10-20% and focus on perfect form",
        "Perform the exercise slower and more controlled",
        "Do more activation work for supporting muscle groups"
    ],
    "medium_issues": [
        "Practice with lighter weight to build muscle memory",
        "Include activation exercises before main workout",
        "Film a few reps to compare with proper form",
        "Take longer rest between sets to maintain quality"
    ],
    "low_issues": [
        "You're doing well! Gradually increase intensity",
        "Focus on consistent depth and range of motion",
        "Consider adding a challenge variation of this exercise",
        "Maintain current form as you progress in weight"
    ],
    "excellent_form": [
        "Excellent form! Consider increasing the weight or intensity",
        "Maintain this level of consistency in your future sessions",
        "You could progress to more advanced variations",
        "Your form makes you less prone to injury - great work!"
    ]
}


class PostureAnalysisService:
    
    @staticmethod
    async def analyze_session(
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        form_data: List[dict]  # List of per-rep form data from frontend
    ) -> PostureSessionAnalysisResponse:
        """
        Analyze a completed posture session and create analysis record
        
        Args:
            db: Database session
            session_id: ID of the posture session
            user_id: ID of the user
            form_data: List of per-rep form quality data from pose detection
        """
        
        # Get the session
        result = await db.execute(
            select(PostureSession).where(PostureSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Posture session not found")
        
        # Analyze reps
        perfect_count, good_count, poor_count, issues, tips = await PostureAnalysisService._analyze_reps(
            form_data
        )
        
        # Calculate scores
        overall_score = PostureAnalysisService._calculate_overall_score(
            perfect_count, good_count, poor_count, len(form_data)
        )
        consistency_score = PostureAnalysisService._calculate_consistency_score(
            form_data
        )
        
        # Generate feedback
        summary = PostureAnalysisService._generate_summary_feedback(
            perfect_count, good_count, poor_count, len(form_data)
        )
        
        # Create analysis record
        analysis = PostureAnalysis(
            session_id=session_id,
            user_id=user_id,
            total_reps=len(form_data),
            perfect_reps=perfect_count,
            good_reps=good_count,
            poor_reps=poor_count,
            overall_form_score=overall_score,
            consistency_score=consistency_score,
            common_issues=issues,
            summary_feedback=summary,
            improvement_tips=tips
        )
        
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        
        return PostureSessionAnalysisResponse.from_orm(analysis)
    
    @staticmethod
    async def _analyze_reps(
        form_data: List[dict]
    ) -> Tuple[int, int, int, List[str], List[str]]:
        """Analyze per-rep form quality"""
        
        perfect_count = 0
        good_count = 0
        poor_count = 0
        all_issues = set()
        
        for rep in form_data:
            score = rep.get("form_score", 0)
            issues = rep.get("issues", [])
            
            # Categorize rep quality
            if score >= 85:
                perfect_count += 1
            elif score >= 70:
                good_count += 1
            else:
                poor_count += 1
            
            # Collect issues
            all_issues.update(issues)
        
        # Generate improvement tips based on issues
        tips = PostureAnalysisService._generate_tips(all_issues, perfect_count, len(form_data))
        
        return perfect_count, good_count, poor_count, list(all_issues), tips
    
    @staticmethod
    def _calculate_overall_score(perfect: int, good: int, poor: int, total: int) -> int:
        """Calculate overall form score (0-100)"""
        if total == 0:
            return 0
        
        # Perfect reps: 100 points, Good: 70 points, Poor: 30 points
        score = ((perfect * 100) + (good * 70) + (poor * 30)) / (total * 100)
        return max(0, min(100, int(score * 100)))
    
    @staticmethod
    def _calculate_consistency_score(form_data: List[dict]) -> int:
        """Calculate consistency score based on form variance"""
        if len(form_data) < 2:
            return 100
        
        scores = [rep.get("form_score", 0) for rep in form_data]
        avg_score = sum(scores) / len(scores)
        
        # Calculate variance
        variance = sum((score - avg_score) ** 2 for score in scores) / len(scores)
        std_dev = variance ** 0.5
        
        # Convert std dev to consistency score (lower std dev = higher consistency)
        # If std dev is 0, consistency is perfect (100)
        # If std dev is 20, consistency is lower (~70)
        consistency = max(0, min(100, 100 - (std_dev * 1.5)))
        
        return int(consistency)
    
    @staticmethod
    def _generate_summary_feedback(
        perfect: int, good: int, poor: int, total: int
    ) -> str:
        """Generate summary feedback for the session"""
        if total == 0:
            return "No reps detected. Please try again."
        
        perfect_pct = (perfect / total) * 100 if total > 0 else 0
        
        if perfect_pct >= 90:
            return f"🌟 Excellent form! {perfect}/{total} reps were perfect. Keep up the great work!"
        elif perfect_pct >= 75:
            return f"👍 Good session! {perfect}/{total} reps were perfect. Focus on consistency for the remaining reps."
        elif perfect_pct >= 50:
            return f"💪 Room for improvement! {perfect} perfect reps out of {total}. Pay attention to form cues on poor reps."
        else:
            return f"⚠️ Form needs work. Only {perfect}/{total} reps were perfect. Reduce weight and focus on technique."
    
    @staticmethod
    def _generate_tips(issues: set, perfect_count: int, total: int) -> List[str]:
        """Generate actionable improvement tips"""
        tips = []
        
        # Check severity of issues
        high_severity_count = sum(
            1 for issue in issues 
            if FORM_ISSUES_DATABASE.get(issue, {}).get("severity") == "high"
        )
        
        perfect_pct = (perfect_count / total * 100) if total > 0 else 0
        
        if high_severity_count > 0:
            # High severity issues - recommend form focus
            tips.extend([
                "⚠️ Reduce weight by 10-20% and focus purely on form",
                "Film yourself to identify form breakdown points",
                "Practice activation exercises for weak areas"
            ])
        elif perfect_pct >= 85:
            # Excellent form
            tips.extend([
                "✨ Your form is excellent - consider increasing weight",
                "Try more challenging variations of this exercise",
                "Maintain this consistency in future sessions"
            ])
        elif perfect_pct >= 70:
            # Good form
            tips.extend([
                "Good progress! Practice with controlled breathing",
                "Add more rest between sets to maintain quality",
                "Gradually increase intensity as consistency improves"
            ])
        else:
            # Needs improvement
            tips.extend([
                "Focus on one form issue at a time",
                "Use lighter weight to build muscle memory",
                "Consider working with a trainer for form check"
            ])
        
        return tips[:4]  # Return top 4 tips

    @staticmethod
    async def get_latest_analysis(
        db: AsyncSession,
        user_id: uuid.UUID
    ) -> Optional[PostureSessionAnalysisResponse]:
        """Get the most recent posture analysis for a user"""
        result = await db.execute(
            select(PostureAnalysis)
            .where(PostureAnalysis.user_id == user_id)
            .order_by(PostureAnalysis.created_at.desc())
            .limit(1)
        )
        analysis = result.scalar_one_or_none()
        if analysis:
            return PostureSessionAnalysisResponse.from_orm(analysis)
        return None

    @staticmethod
    async def get_user_analyses(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 20
    ) -> List[PostureSessionAnalysisResponse]:
        """Get posture analyses for a user"""
        result = await db.execute(
            select(PostureAnalysis)
            .where(PostureAnalysis.user_id == user_id)
            .order_by(PostureAnalysis.created_at.desc())
            .limit(limit)
        )
        analyses = result.scalars().all()
        return [PostureSessionAnalysisResponse.from_orm(a) for a in analyses]
