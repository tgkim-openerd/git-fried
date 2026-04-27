// Performance bench — `docs/plan/20 §3-1`.
//
// 실행: `BENCH_REPO=/path/to/repo cargo bench --bench git_perf`
//
// BENCH_REPO 환경변수가 가리키는 git 레포에 대해 read_status / list_branches /
// compute_graph 의 wall time 을 criterion 으로 측정한다. baseline 등록은
// `cargo bench -- --save-baseline <name>` 로, 비교는 `--baseline <name>`.
//
// 기본 측정 대상:
//   - status_clean       — read_status (working tree 깨끗한 상태 가정)
//   - list_branches_50   — list_branches (50개 브랜치 가정)
//   - graph_1k / 10k     — compute_graph (입력 limit = 1_000 / 10_000)
//
// async API (commit / sync / fetch) 는 별도 tokio runtime 가 필요해서
// 본 bench 에서는 제외 — `apps/desktop/src-tauri/src/git/tests.rs` 의
// integration test 가 이미 wall time 을 print 함.

use std::path::PathBuf;

use criterion::{criterion_group, criterion_main, Criterion};
use git_fried_lib::git::{self};

fn bench_repo() -> PathBuf {
    let raw = std::env::var("BENCH_REPO").expect(
        "BENCH_REPO 환경변수가 필요합니다. 예) BENCH_REPO=/path/to/repo cargo bench --bench git_perf",
    );
    PathBuf::from(raw)
}

fn bench_status(c: &mut Criterion) {
    let repo = bench_repo();
    c.bench_function("status_clean", |b| {
        b.iter(|| {
            let _ = git::status::read_status(&repo);
        })
    });
}

fn bench_list_branches(c: &mut Criterion) {
    let repo = bench_repo();
    c.bench_function("list_branches", |b| {
        b.iter(|| {
            let _ = git::branch::list_branches(&repo);
        })
    });
}

fn bench_graph(c: &mut Criterion) {
    let repo = bench_repo();

    let mut group = c.benchmark_group("compute_graph");
    for limit in [1_000usize, 10_000usize].iter() {
        group.bench_with_input(format!("limit_{}", limit), limit, |b, &lim| {
            b.iter(|| {
                let _ = git::graph::compute_graph(&repo, lim);
            })
        });
    }
    group.finish();
}

criterion_group!(benches, bench_status, bench_list_branches, bench_graph);
criterion_main!(benches);
