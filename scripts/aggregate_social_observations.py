"""Aggregate authorized social-platform exports without retaining post text."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "social_observations.json"
MIN_GROUP_SIZE = 30  # Project display heuristic, not a statistical or legal standard.
RULE_SET_VERSION = "cn-work-experience-keywords-v1"

TOPICS = {
    "work_time": {
        "label": "工时与加班",
        "keywords": ["加班", "996", "007", "大小周", "单休", "双休", "准点下班", "准时下班", "on-call", "on call", "调休"],
    },
    "pay_change": {
        "label": "工资与奖金",
        "keywords": ["降薪", "涨薪", "调薪", "发薪", "拖欠工资", "欠薪", "年终奖", "奖金", "绩效", "月薪", "薪资", "工资"],
    },
    "benefits": {
        "label": "社保与福利",
        "keywords": ["五险一金", "公积金", "社保", "年假", "带薪休假", "餐补", "住房补贴", "补贴", "商业保险"],
    },
    "stability": {
        "label": "就业稳定性",
        "keywords": ["裁员", "优化", "裁撤", "试用期", "转正", "倒闭", "欠薪", "稳定性", "外包转正"],
    },
    "intensity": {
        "label": "工作强度与压力",
        "keywords": ["强度", "节奏快", "高压", "压力大", "很忙", "太忙", "内卷", "疲惫", "疲劳", "轻松", "burnout"],
    },
    "management": {
        "label": "管理与团队氛围",
        "keywords": ["管理", "领导", "PUA", "画饼", "团队氛围", "扁平化", "甩锅", "沟通", "内耗"],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="授权 API 导出或用户授权文件；支持 JSON 数组 / JSONL")
    parser.add_argument("--platform", required=True, help="平台名称，例如 weibo")
    parser.add_argument("--source-name", required=True, help="数据来源名称或接口名称")
    parser.add_argument("--source-url", required=True, help="平台官方 API / 数据集说明链接；不要填写个人帖子链接")
    parser.add_argument("--query-label", required=True, help="检索词与查询范围的简要说明")
    parser.add_argument("--collected-at", default=datetime.now(timezone.utc).isoformat())
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def load_posts(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8-sig")
    if not raw.strip():
        return []
    if raw.lstrip().startswith("["):
        payload = json.loads(raw)
        if not isinstance(payload, list):
            raise ValueError("JSON input must be an array of records")
        posts = payload
    else:
        posts = [json.loads(line) for line in raw.splitlines() if line.strip()]
    if any(not isinstance(post, dict) for post in posts):
        raise ValueError("Every input record must be a JSON object")
    return posts


def month_of(value: object) -> str:
    if not value:
        return "日期未提供"
    raw = str(value).strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.strftime("%Y-%m")
    except ValueError:
        match = re.match(r"^(\d{4}-\d{2})", raw)
        return match.group(1) if match else "日期未提供"


def normalized_text(post: dict) -> str:
    value = post.get("text") or post.get("content") or post.get("full_text") or ""
    return re.sub(r"\s+", " ", str(value)).strip().lower()


def stable_fingerprint(post: dict, text: str) -> str:
    # IDs are used only transiently for de-duplication and never written to the output.
    source_id = post.get("id") or post.get("idstr")
    seed = f"id:{source_id}" if source_id else f"text:{text}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def read_group_value(post: dict, *keys: str) -> str:
    for key in keys:
        value = post.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "未分类"


def validate_source_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("--source-url must be a public HTTPS platform/API documentation URL")
    if any(any(term in key.lower() for term in ("token", "secret", "password", "auth", "key"))
           for key, _ in parse_qsl(parsed.query)):
        raise ValueError("--source-url must not contain credentials or secret query parameters")
    return value.strip()


def safe_dimension(value: str) -> str:
    # Group labels are public; common direct identifiers must not pass through.
    if len(value) > 60 or "@" in value or "http://" in value.lower() or "https://" in value.lower():
        return "未分类"
    if re.search(r"(?<!\d)(?:\+?\d[\s()-]*){7,}(?!\d)", value):
        return "未分类"
    return value


def atomic_write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def aggregate(posts: list[dict], args: argparse.Namespace) -> dict:
    groups: dict[tuple[str, str, str], dict] = defaultdict(lambda: {"sample_size": 0, "topic_counts": {key: 0 for key in TOPICS}})
    seen: set[str] = set()
    duplicate_count = 0
    empty_count = 0

    for post in posts:
        text = normalized_text(post)
        if not text:
            empty_count += 1
            continue
        fingerprint = stable_fingerprint(post, text)
        if fingerprint in seen:
            duplicate_count += 1
            continue
        seen.add(fingerprint)
        city = safe_dimension(read_group_value(post, "city", "location"))
        role = safe_dimension(read_group_value(post, "role", "occupation"))
        period = month_of(post.get("created_at") or post.get("created"))
        group = groups[(city, role, period)]
        group["sample_size"] += 1
        for topic_id, topic in TOPICS.items():
            if any(keyword.lower() in text for keyword in topic["keywords"]):
                group["topic_counts"][topic_id] += 1

    result_groups = []
    suppressed = 0
    for (city, role, period), values in sorted(groups.items()):
        sample_size = values["sample_size"]
        if sample_size < MIN_GROUP_SIZE:
            suppressed += 1
            result_groups.append({
                "location": city,
                "role": role,
                "period": period,
                "sample_size": None,
                "sample_band": f"少于 {MIN_GROUP_SIZE} 条",
                "topic_counts": {},
                "topic_rates_pct": {},
                "suppressed": True,
            })
            continue
        rates = {topic: round(count / sample_size * 100, 1) for topic, count in values["topic_counts"].items()}
        result_groups.append({
            "location": city,
            "role": role,
            "period": period,
            "sample_size": sample_size,
            "sample_band": None,
            "topic_counts": values["topic_counts"],
            "topic_rates_pct": rates,
            "suppressed": False,
        })

    dataset_key = hashlib.sha256(f"{args.platform}|{args.source_name}|{args.query_label}".encode("utf-8")).hexdigest()[:16]
    return {
        "dataset_key": dataset_key,
        "platform": args.platform,
        "source_name": args.source_name,
        "source_url": args.source_url,
        "query_label": args.query_label,
        "collected_at": args.collected_at,
        "rule_set_version": RULE_SET_VERSION,
        "minimum_group_size": MIN_GROUP_SIZE,
        "suppressed_group_count": suppressed,
        "groups": result_groups,
    }


def main() -> int:
    args = parse_args()
    try:
        args.source_url = validate_source_url(args.source_url)
        for field in ("platform", "source_name", "query_label"):
            value = getattr(args, field).strip()
            if not value or len(value) > 160:
                raise ValueError(f"--{field.replace('_', '-')} must contain 1 to 160 characters")
            setattr(args, field, value)
        dataset = aggregate(load_posts(args.input), args)
        try:
            existing = json.loads(args.output.read_text(encoding="utf-8"))
        except FileNotFoundError:
            existing = {}
        if not isinstance(existing, dict) or existing.get("data_kind") != "social_experience_keyword_aggregate":
            existing = {}
        datasets = [item for item in existing.get("datasets", []) if item.get("dataset_key") != dataset["dataset_key"]]
        datasets.append(dataset)
        payload = {
            "schema_version": 1,
            "data_kind": "social_experience_keyword_aggregate",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "rule_set_version": RULE_SET_VERSION,
            "topics": [{"id": key, "label": value["label"], "keywords": value["keywords"]} for key, value in TOPICS.items()],
            "datasets": datasets,
            "privacy": "Raw text, author names, handles, post IDs, and per-post URLs are not written to this file.",
            "limitations": [
                "Posts are self-selected and keyword-based; mention rates are not population prevalence, verified facts, or sentiment scores.",
                "City and role are taken only from structured input fields; missing fields are not inferred from post text.",
                "Monthly groups under the project display threshold are suppressed; the threshold is a project heuristic, not a statistical guarantee.",
                "Do not merge these observations into official wage means or use them as a recommendation score.",
            ],
        }
        atomic_write(args.output, payload)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Social observation aggregation failed: {exc}", file=sys.stderr)
        return 1
    print(f"Aggregated authorized export into {len(dataset['groups'])} city/role/month groups.")
    print(f"Suppressed groups below {MIN_GROUP_SIZE} posts: {dataset['suppressed_group_count']}.")
    print(f"Output: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
