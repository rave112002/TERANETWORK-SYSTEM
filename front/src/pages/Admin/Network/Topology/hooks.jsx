import { useMemo } from "react";

import { useGetNaps } from "../../../../services/requests/admin/network/naps";
import { useGetOlts } from "../../../../services/requests/admin/network/olts";
import { useGetOnus } from "../../../../services/requests/admin/network/onus";
import { useGetPonPorts } from "../../../../services/requests/admin/network/pon-ports";
import { useGetSplitters } from "../../../../services/requests/admin/network/splitters";
import { decodeHTML } from "../../../../utils/decode-html";

/**
 * The OLT → PON port → splitter → NAP → ONU tree.
 *
 * ── Assembled in the browser, on purpose ────────────────────────────────────
 *
 * Five list calls, joined here, rather than a bespoke `/topology` endpoint. A
 * plant of this size is a few hundred rows; the five endpoints already exist,
 * already enforce branch scoping, and are already cached by React Query, so the
 * tree costs nothing extra when the user has just come from one of the list
 * pages. If the plant ever outgrows a page of each, this is the seam to replace
 * with a single server-built tree — the shape below is what it should return.
 *
 * Splitters cascade, so their level is built recursively and guarded against a
 * loop: the API refuses to create one, but a tree that hangs on bad data is a
 * worse failure than one that shows it.
 */

const PAGE = { page: 1, pageSize: 100 };

export const useTopologyData = () => {
  const olts = useGetOlts(PAGE);
  const ponPorts = useGetPonPorts(PAGE);
  const splitters = useGetSplitters(PAGE);
  const naps = useGetNaps(PAGE);
  const onus = useGetOnus({ ...PAGE, pageSize: 100 });

  const queries = [olts, ponPorts, splitters, naps, onus];
  const isLoading = queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);
  const error = queries.find((q) => q.error)?.error ?? null;

  const refetch = () => queries.forEach((q) => q.refetch());

  const tree = useMemo(() => {
    const oltRows = olts.data?.data?.olts || [];
    const portRows = ponPorts.data?.data?.ponPorts || [];
    const splitterRows = splitters.data?.data?.splitters || [];
    const napRows = naps.data?.data?.naps || [];
    const onuRows = onus.data?.data?.onus || [];

    const onusByNap = new Map();
    for (const onu of onuRows) {
      if (!onu.napId) continue;
      if (!onusByNap.has(onu.napId)) onusByNap.set(onu.napId, []);
      onusByNap.get(onu.napId).push(onu);
    }

    const napsBySplitter = new Map();
    for (const nap of napRows) {
      if (!napsBySplitter.has(nap.splitterId)) napsBySplitter.set(nap.splitterId, []);
      napsBySplitter.get(nap.splitterId).push(nap);
    }

    const splittersByParent = new Map();
    for (const splitter of splitterRows) {
      const key = `${splitter.parentType}:${splitter.parentId}`;
      if (!splittersByParent.has(key)) splittersByParent.set(key, []);
      splittersByParent.get(key).push(splitter);
    }

    const napNode = (nap) => {
      const children = onusByNap.get(nap.napId) || [];
      return {
        key: `nap:${nap.napId}`,
        kind: "nap",
        label: decodeHTML(nap.label),
        meta: `${children.length}/${nap.totalPorts} ports`,
        state: children.length >= nap.totalPorts ? "full" : null,
        children: children.map((onu) => ({
          key: `onu:${onu.onuId}`,
          kind: "onu",
          label: onu.mac || onu.serialNo || "Unidentified ONU",
          meta: onu.napPort ? `port ${onu.napPort}` : "unseated",
          state: onu.provisioningState,
          children: [],
        })),
      };
    };

    // `seen` is per-branch of the walk: a splitter appearing twice on one path
    // is a loop, and the walk stops rather than recursing forever.
    const splitterNode = (splitter, seen) => {
      if (seen.has(splitter.splitterId)) {
        return {
          key: `loop:${splitter.splitterId}`,
          kind: "error",
          label: `${decodeHTML(splitter.label)} — cycle detected`,
          meta: "check this splitter's parent",
          children: [],
        };
      }

      const nextSeen = new Set(seen).add(splitter.splitterId);
      const childSplitters = splittersByParent.get(`splitter:${splitter.splitterId}`) || [];
      const childNaps = napsBySplitter.get(splitter.splitterId) || [];

      return {
        key: `splitter:${splitter.splitterId}`,
        kind: "splitter",
        label: decodeHTML(splitter.label),
        meta: splitter.ratio,
        children: [
          ...childSplitters.map((s) => splitterNode(s, nextSeen)),
          ...childNaps.map(napNode),
        ],
      };
    };

    const portsByOlt = new Map();
    for (const port of portRows) {
      if (!portsByOlt.has(port.oltId)) portsByOlt.set(port.oltId, []);
      portsByOlt.get(port.oltId).push(port);
    }

    return oltRows.map((olt) => ({
      key: `olt:${olt.oltId}`,
      kind: "olt",
      label: decodeHTML(olt.name),
      meta: `${String(olt.vendor || "").toUpperCase()} · ${olt.host}`,
      children: (portsByOlt.get(olt.oltId) || []).map((port) => ({
        key: `pon:${port.ponPortId}`,
        kind: "ponPort",
        label: `Port ${port.portIndex}`,
        meta: `${port.usedPorts ?? 0}/${port.capacity}`,
        children: (splittersByParent.get(`pon_port:${port.ponPortId}`) || []).map((s) =>
          splitterNode(s, new Set()),
        ),
      })),
    }));
  }, [olts.data, ponPorts.data, splitters.data, naps.data, onus.data]);

  const counts = useMemo(
    () => ({
      olts: olts.data?.data?.pagination?.total || 0,
      ponPorts: ponPorts.data?.data?.pagination?.total || 0,
      splitters: splitters.data?.data?.pagination?.total || 0,
      naps: naps.data?.data?.pagination?.total || 0,
      onus: onus.data?.data?.pagination?.total || 0,
    }),
    [olts.data, ponPorts.data, splitters.data, naps.data, onus.data],
  );

  // Every list is capped at one page; say so rather than quietly showing a
  // partial plant as though it were the whole thing.
  const truncated = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, total]) => total > PAGE.pageSize)
        .map(([key]) => key),
    [counts],
  );

  return { tree, counts, truncated, isLoading, isFetching, error, refetch };
};
