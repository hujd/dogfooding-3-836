"""内置测试用例库 - 重构版（优化查询性能）"""
from __future__ import annotations

from ..models import Dimension, TestCase


_ALL_CASES: list[TestCase] = [
    TestCase(
        id="comp-001",
        dimension=Dimension.COMPREHENSION,
        title="LRU Cache 实现",
        description="基于 OrderedDict 的 LRU 缓存",
        language="python",
        code='''from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
''',
        expected_key_points=[
            "LRU 缓存淘汰策略",
            "OrderedDict 维护访问顺序",
            "get 时 move_to_end 标记为最近使用",
            "超容量时淘汰最久未用",
        ],
    ),
    TestCase(
        id="bug-001",
        dimension=Dimension.BUG_DETECTION,
        title="二分查找 off-by-one",
        description="经典的二分查找实现，含有边界错误",
        language="python",
        code='''def binary_search(arr, target):
    left, right = 0, len(arr)
    while left < right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid
        else:
            right = mid
    return -1
''',
        known_bugs=[
            "left = mid 应为 left = mid + 1，否则死循环",
            "right 初始化应为 len(arr) - 1",
        ],
    ),
    TestCase(
        id="cmplx-001",
        dimension=Dimension.COMPLEXITY,
        title="归并排序",
        description="标准归并排序实现",
        language="python",
        code='''def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
''',
        expected_complexity="时间 O(n log n)，空间 O(n)",
    ),
    TestCase(
        id="refact-001",
        dimension=Dimension.REFACTORING,
        title="意面式用户验证",
        description="过长、重复、职责不清的验证函数",
        language="python",
        code='''def register_user(data):
    if not data.get("username"):
        return {"error": "用户名不能为空"}
    if len(data["username"]) < 3:
        return {"error": "用户名至少 3 个字符"}
    import re
    if not re.match(r"^[a-zA-Z0-9_]+$", data["username"]):
        return {"error": "用户名格式不正确"}
    if not data.get("email"):
        return {"error": "邮箱不能为空"}
    if "@" not in data["email"]:
        return {"error": "邮箱格式不正确"}
    if not data.get("password"):
        return {"error": "密码不能为空"}
    if len(data["password"]) < 8:
        return {"error": "密码至少 8 个字符"}
    return {"success": True}
''',
        expected_key_points=[
            "函数过长，应拆分",
            "import 不应在函数内部",
            "缺少异常处理",
            "数据库操作缺失",
        ],
    ),
    TestCase(
        id="sec-001",
        dimension=Dimension.SECURITY,
        title="Web 应用多漏洞",
        description="Flask 应用包含多种常见安全漏洞",
        language="python",
        code='''from flask import Flask, request
import sqlite3

app = Flask(__name__)
SECRET_KEY = "hardcoded_secret_123"

@app.route("/search")
def search():
    query = request.args.get("q", "")
    return f"<h1>搜索结果：{query}</h1>"

@app.route("/user/<user_id>")
def get_user(user_id):
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return str(cursor.fetchone())
''',
        known_vulnerabilities=[
            "XSS - 直接嵌入用户输入",
            "SQL 注入 - f-string 拼接 SQL",
            "硬编码密钥",
        ],
    ),
    TestCase(
        id="exec-001",
        dimension=Dimension.EXECUTION_TRACE,
        title="递归斐波那契 + 记忆化",
        description="带缓存的递归斐波那契",
        language="python",
        code='''cache = {}

def fib(n):
    if n in cache:
        return cache[n]
    if n <= 1:
        cache[n] = n
        return n
    result = fib(n - 1) + fib(n - 2)
    cache[n] = result
    return result

print(fib(5))
''',
        input_data="n=5",
        expected_output="5",
    ),
    TestCase(
        id="trans-001",
        dimension=Dimension.TRANSLATION,
        title="Python → Go 快速排序",
        description="将 Python 快速排序翻译为 Go",
        language="python",
        target_language="go",
        code='''def quicksort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
''',
        expected_key_points=[
            "Go 切片对应 Python 列表",
            "列表推导式转为 for 循环",
            "fmt.Println 替代 print",
        ],
    ),
    TestCase(
        id="comp-002",
        dimension=Dimension.COMPREHENSION,
        title="生产者 - 消费者模式",
        description="基于 asyncio.Queue 的异步生产者 - 消费者",
        language="python",
        code='''import asyncio

async def producer(queue: asyncio.Queue, n: int):
    for i in range(n):
        await queue.put(i)
    await queue.put(None)

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        print(f"Consumed: {item}")

async def main():
    queue = asyncio.Queue(maxsize=5)
    await asyncio.gather(producer(queue, 10), consumer(queue))

asyncio.run(main())
''',
        expected_key_points=[
            "异步生产者 - 消费者模式",
            "asyncio.Queue 实现数据传递",
            "None 作为终止信号",
            "maxsize 实现背压控制",
        ],
    ),
    TestCase(
        id="bug-002",
        dimension=Dimension.BUG_DETECTION,
        title="并发计数器竞态条件",
        description="多线程计数器缺少同步",
        language="python",
        code='''import threading

counter = 0

def increment(n):
    global counter
    for _ in range(n):
        counter += 1

threads = []
for _ in range(10):
    t = threading.Thread(target=increment, args=(100000,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

print(f"Expected: 1000000, Got: {counter}")
''',
        known_bugs=[
            "counter += 1 不是原子操作",
            "缺少 threading.Lock 保护",
        ],
    ),
    TestCase(
        id="exec-002",
        dimension=Dimension.EXECUTION_TRACE,
        title="闭包和作用域",
        description="考察模型对闭包变量捕获的理解",
        language="python",
        code='''def make_counters():
    counters = []
    for i in range(3):
        def counter(x, _i=i):
            return _i + x
        counters.append(counter)
    return counters

fns = make_counters()
results = [fn(10) for fn in fns]
print(results)
''',
        input_data="无",
        expected_output="[10, 11, 12]",
    ),
]

# 预构建索引，优化查询性能
_CASES_BY_ID: dict[str, TestCase] = {}
_CASES_BY_DIMENSION: dict[Dimension, list[TestCase]] = {}


def _build_indexes() -> None:
    """构建查询索引"""
    global _CASES_BY_ID, _CASES_BY_DIMENSION
    for case in _ALL_CASES:
        _CASES_BY_ID[case.id] = case
        if case.dimension not in _CASES_BY_DIMENSION:
            _CASES_BY_DIMENSION[case.dimension] = []
        _CASES_BY_DIMENSION[case.dimension].append(case)


# 模块加载时构建索引
_build_indexes()


def get_all_cases() -> list[TestCase]:
    """获取所有测试用例"""
    return _ALL_CASES.copy()


def get_cases_by_dimension(dimension: Dimension) -> list[TestCase]:
    """按维度获取测试用例（O(1) 查询）"""
    return _CASES_BY_DIMENSION.get(dimension, []).copy()


def get_case_by_id(case_id: str) -> TestCase | None:
    """按 ID 获取测试用例（O(1) 查询）"""
    return _CASES_BY_ID.get(case_id)
