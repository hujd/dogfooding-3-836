"""测试用例路由"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import Dimension
from ..services.test_case_store import get_all_cases, get_cases_by_dimension, get_case_by_id

router = APIRouter(prefix="/api/v1/test-cases", tags=["test-cases"])


@router.get("", response_model=list)
async def list_test_cases():
    """获取所有内置测试用例"""
    return get_all_cases()


@router.get("/dimension/{dimension}", response_model=list)
async def list_by_dimension(dimension: str):
    """获取特定维度的测试用例

    Args:
        dimension: 维度名称

    Raises:
        HTTPException: 无效维度时返回 400
    """
    try:
        dim = Dimension(dimension)
    except ValueError:
        valid = [d.value for d in Dimension]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid dimension. Valid: {valid}"
        )
    return get_cases_by_dimension(dim)


@router.get("/{case_id}", response_model=dict)
async def get_test_case(case_id: str):
    """根据 ID 获取测试用例

    Args:
        case_id: 用例 ID

    Raises:
        HTTPException: 用例不存在时返回 404
    """
    case = get_case_by_id(case_id)
    if not case:
        raise HTTPException(
            status_code=404,
            detail=f"Test case {case_id} not found"
        )
    return case.model_dump()