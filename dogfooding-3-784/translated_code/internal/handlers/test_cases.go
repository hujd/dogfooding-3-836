// internal/handlers/test_cases.go
// 测试用例路由处理
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"code-eval/internal/models"
)

// RegisterTestCaseRoutes 注册测试用例路由
func RegisterTestCaseRoutes(rg *gin.RouterGroup) {
	rg.GET("/test-cases", listTestCases)
	rg.GET("/test-cases/dimension/:dimension", listByDimension)
	rg.GET("/test-cases/:case_id", getTestCase)
}

// listTestCases 获取所有测试用例
func listTestCases(c *gin.Context) {
	c.JSON(http.StatusOK, testCases)
}

// listByDimension 按维度获取测试用例
func listByDimension(c *gin.Context) {
	dimension := c.Param("dimension")

	// 验证维度
	dim := models.Dimension(dimension)
	if !dim.IsValid() {
		validDims := []string{
			string(models.DimensionComprehension),
			string(models.DimensionBugDetection),
			string(models.DimensionComplexity),
			string(models.DimensionRefactoring),
			string(models.DimensionSecurity),
			string(models.DimensionExecutionTrace),
			string(models.DimensionTranslation),
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"error":       "Invalid dimension",
			"valid_values": validDims,
		})
		return
	}

	// 过滤用例
	var filtered []models.TestCase
	for _, tc := range testCases {
		if tc.Dimension == dim {
			filtered = append(filtered, tc)
		}
	}

	c.JSON(http.StatusOK, filtered)
}

// getTestCase 获取单个测试用例
func getTestCase(c *gin.Context) {
	caseID := c.Param("case_id")

	for _, tc := range testCases {
		if tc.ID == caseID {
			c.JSON(http.StatusOK, tc)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Test case not found"})
}
