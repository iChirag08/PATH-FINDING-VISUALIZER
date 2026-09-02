#include "pathfinder.h"
#include <emscripten/emscripten.h>

static Pathfinder* g_pf = nullptr;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void pf_init(int rows, int cols) {
    delete g_pf;
    g_pf = new Pathfinder(rows, cols);
}

EMSCRIPTEN_KEEPALIVE
void pf_set_wall(int row, int col, int wall) {
    if (g_pf) g_pf->setWall(row, col, wall != 0);
}

EMSCRIPTEN_KEEPALIVE
void pf_set_weight(int row, int col, int weight) {
    if (g_pf) g_pf->setWeight(row, col, weight);
}

EMSCRIPTEN_KEEPALIVE
void pf_set_start(int row, int col) {
    if (g_pf) g_pf->setStart(row, col);
}

EMSCRIPTEN_KEEPALIVE
void pf_set_end(int row, int col) {
    if (g_pf) g_pf->setEnd(row, col);
}

EMSCRIPTEN_KEEPALIVE
void pf_clear_walls() {
    if (g_pf) g_pf->clearWalls();
}

EMSCRIPTEN_KEEPALIVE
void pf_reset() {
    if (g_pf) g_pf->reset();
}

EMSCRIPTEN_KEEPALIVE
int* pf_run(int algo, int* outLen) {
    if (!g_pf) {
        *outLen = 0;
        return nullptr;
    }

    SearchResult result = g_pf->run(static_cast<Algorithm>(algo));

    // Pack: [found, visitedCount, pathLength, peakMemory, executionMs*1000,
    //        visitCount, pathCount, visitOrder..., path...]
    int visitCount = static_cast<int>(result.visitOrder.size());
    int pathCount = static_cast<int>(result.path.size());
    int totalLen = 7 + visitCount + pathCount;

    int* buf = new int[totalLen];
    buf[0] = result.found ? 1 : 0;
    buf[1] = result.visitedCount;
    buf[2] = result.pathLength;
    buf[3] = result.peakMemory;
    buf[4] = static_cast<int>(result.executionMs * 1000);
    buf[5] = visitCount;
    buf[6] = pathCount;

    for (int i = 0; i < visitCount; ++i) {
        buf[7 + i] = result.visitOrder[i];
    }
    for (int i = 0; i < pathCount; ++i) {
        buf[7 + visitCount + i] = result.path[i];
    }

    *outLen = totalLen;
    return buf;
}

EMSCRIPTEN_KEEPALIVE
void pf_free(int* ptr) {
    delete[] ptr;
}

} // extern "C"
