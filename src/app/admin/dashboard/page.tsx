"use client";

import React, { useEffect, useState } from "react";
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryTooltip,
  VictoryPie,
  VictoryStack,
} from "victory";

type Result = {
  position_name: string;
  candidate_name: string;
  vote_count: number;
};

type CourseData = {
  course: string;
  year_level: string;
  label: string;
  voters: number;
  turnout?: number;
};

/* Summary shape returned by /api/dashboard/summary */
type Summary = {
  election?: {
    id?: number;
    title: string;
    status: string;
    start_time: string;
    end_time: string;
  };
  voters: number;
  candidates: number;
  voted: number;
  courses?: CourseData[];
};

const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<"before" | "ongoing" | "ended">("before");

  const fetchData = async (): Promise<void> => {
    try {
      const [summaryRes, resultsRes] = await Promise.all([
        fetch("/api/dashboard/summary"),
        fetch("/api/results"),
      ]);

      if (summaryRes.ok) {
        const summaryData: Summary = await summaryRes.json();
        setSummary(summaryData);
      } else {
        console.warn("/api/dashboard/summary returned", summaryRes.status);
        setSummary(null);
      }

      if (resultsRes.ok) {
        const resultsData: { results: Result[] } = await resultsRes.json();
        setResults(resultsData.results || []);
      } else {
        console.warn("/api/results returned", resultsRes.status);
        setResults([]);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
      setSummary(null);
      setResults([]);
    }
  };

  useEffect(() => {
    fetchData();
    const id = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!summary?.election) return;
    const startMs = new Date(summary.election.start_time).getTime();
    const endMs = new Date(summary.election.end_time).getTime();

    const tick = (): void => {
      const now = Date.now();
      if (now < startMs) {
        setPhase("before");
        setTimeLeft(Math.floor((startMs - now) / 1000));
      } else if (now <= endMs) {
        setPhase("ongoing");
        setTimeLeft(Math.floor((endMs - now) / 1000));
      } else {
        setPhase("ended");
        setTimeLeft(0);
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [summary?.election]);

  const formatTime = (secs: number | null): string => {
    if (secs === null) return "--:--:--";
    if (secs <= 0) return "00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${hh} : ${mm} : ${ss}`;
  };

  const groupedResults = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.position_name] ||= []).push(r);
    return acc;
  }, {});

  const courseData: CourseData[] = summary?.courses ?? [];
  const totalVoters: number = summary?.voters ?? 0;

  const courses = Array.from(new Set(courseData.map((d) => d.course)));

  const yearLevels = Array.from(
    new Set(courseData.map((d) => d.year_level))
  ).sort((a, b) => Number(a) - Number(b));

  const coursesByName: Record<string, string> = {};
  courses.forEach((course) => {
    coursesByName[course] = course;
  });

  const makeVoterTicks = (max: number): number[] => {
    if (max <= 10) return Array.from({ length: max + 1 }, (_, i) => i);
    const step = Math.ceil(max / 9);
    const ticks = Array.from(
      { length: Math.floor(max / step) + 1 },
      (_, i) => i * step
    );
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  };
  const voterTicks = makeVoterTicks(totalVoters);

  // --- Predictive Analytics ---
  const voterTurnout: number =
    summary && summary.voters > 0 ? (summary.voted / summary.voters) * 100 : 0;

  let participationPrediction: string = "Analyzing...";
  let participationColor: string = "#9E9E9E";

  if (voterTurnout >= 80) {
    participationPrediction = "High Participation";
    participationColor = "#4CAF50"; // green
  } else if (voterTurnout >= 50) {
    participationPrediction = "Moderate Participation";
    participationColor = "#FFB300"; // yellow
  } else {
    participationPrediction = "Low Participation";
    participationColor = "#D32F2F"; // red
  }

  let competitionPrediction = "";
  if (results.length > 1) {
    const sorted = [...results].sort((a, b) => b.vote_count - a.vote_count);
    const top = sorted[0].vote_count;
    const second = sorted[1].vote_count;
    const totalVotes = sorted.reduce((sum, c) => sum + c.vote_count, 0);
    const leadPercent =
      totalVotes > 0 ? ((top - second) / totalVotes) * 100 : 0;

    if (leadPercent >= 20) {
      competitionPrediction = "High Chance of Winning";
    } else if (leadPercent < 5) {
      competitionPrediction = "Tight Race / Close Competition";
    } else {
      competitionPrediction = "Moderate Lead";
    }
  }

  // Example of previous turnout (placeholder)
  const previousTurnout = 70;
  const decline = previousTurnout - voterTurnout;
  if (decline > 15) {
    participationPrediction = "Decline in Voter Engagement";
    participationColor = "#D32F2F";
  }

  return (
    <div className="p-6 space-y-6">
      {summary?.election && (
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-[#791010]">
          {summary.election.title} ({summary.election.status.toUpperCase()})
        </h1>
      )}

      {/* --- Voter Stats --- */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "VOTERS", value: summary.voters, color: "#D32F2F" },
            {
              label: "CANDIDATES",
              value: summary.candidates,
              color: "#1976D2",
            },
            {
              label: "TOTAL WHO VOTED",
              value: summary.voted,
              color: "#388E3C",
              remainder: Math.max(summary.voters - summary.voted, 0),
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white shadow rounded-lg p-3 flex flex-col items-center"
            >
              <VictoryPie
                data={[
                  { x: "val", y: item.value ?? 0 },
                  {
                    x: "rem",
                    y: item.remainder ?? Math.max(1, item.value ?? 0),
                  },
                ]}
                innerRadius={44}
                labels={() => null}
                colorScale={[item.color, "#f3f3f3"]}
                width={140}
                height={140}
              />
              <div
                className="mt-2 text-lg font-bold"
                style={{ color: item.color }}
              >
                {item.value}
              </div>
              <div className="text-sm text-gray-600">{item.label}</div>
            </div>
          ))}

          <div className="bg-white shadow rounded-lg p-3 flex flex-col items-center justify-center">
            {phase === "before" && (
              <>
                <div className="text-sm text-gray-700 uppercase">
                  Voting not started
                </div>
                <div className="mt-1 font-semibold text-[#791010] text-sm">
                  Starts in: {formatTime(timeLeft)}
                </div>
              </>
            )}
            {phase === "ongoing" && (
              <>
                <div className="text-sm text-gray-700 uppercase">
                  Time remaining
                </div>
                <div className="mt-1 font-semibold text-[#791010] text-sm">
                  {formatTime(timeLeft)}
                </div>
              </>
            )}
            {phase === "ended" && (
              <div className="text-lg font-semibold text-gray-600">
                🛑 Voting has ended
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Predictive Analytics Summary --- */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-center text-[#791010] font-extrabold text-2xl mb-3">
          🔮 Predictive Analytics Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          {/* Participation */}
          <div className="p-3 border rounded-lg">
            <h3 className="text-gray-600 font-semibold">Voter Turnout</h3>
            <p
              className="text-2xl font-bold"
              style={{ color: participationColor }}
            >
              {voterTurnout.toFixed(1)}%
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: participationColor }}
            >
              {participationPrediction}
            </p>
          </div>

          {/* Competition */}
          <div className="p-3 border rounded-lg">
            <h3 className="text-gray-600 font-semibold">Election Trend</h3>
            <p className="text-xl font-bold text-[#1976D2]">
              {competitionPrediction || "Analyzing..."}
            </p>
          </div>
        </div>

        {/* --- Color Legend --- */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <p className="font-semibold mb-1">Color Indicators:</p>
          <div className="flex justify-center gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-[#4CAF50] rounded-full"></span>{" "}
              High Participation (≥ 80%)
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-[#FFB300] rounded-full"></span>{" "}
              Moderate Participation (50–79%)
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-[#D32F2F] rounded-full"></span>{" "}
              Low Participation (&lt; 50%)
            </div>
          </div>
        </div>
      </div>

      {/* --- Results Per Position --- */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h1 className="text-center text-[#791010] font-extrabold mb-2 text-2xl">
          RESULT PER POSITION
        </h1>
        <div className="space-y-6">
          {Object.keys(groupedResults).length > 0 ? (
            Object.keys(groupedResults).map((position) => (
              <div
                key={position}
                className="bg-[#f7fbff] rounded-lg p-3 shadow-sm"
              >
                <h2 className="text-center text-[#791010] font-bold mb-2 text-base sm:text-lg">
                  {position.toUpperCase()}
                </h2>
                <VictoryChart
                  theme={VictoryTheme.material}
                  domainPadding={16}
                  height={160}
                  padding={{ top: 10, bottom: 40, left: 140, right: 30 }}
                >
                  <VictoryAxis
                    dependentAxis
                    style={{
                      axis: { stroke: "transparent" },
                      tickLabels: { fontSize: 11, fill: "#333" },
                    }}
                  />
                  <VictoryAxis
                    tickValues={voterTicks}
                    tickFormat={(t) => `${t}`}
                  />
                  <VictoryBar
                    horizontal
                    cornerRadius={4}
                    data={groupedResults[position]}
                    x="candidate_name"
                    y="vote_count"
                    labels={({ datum }) => String(datum.vote_count)}
                    labelComponent={
                      <VictoryTooltip
                        style={{ fontSize: 10 }}
                        flyoutStyle={{ fill: "white" }}
                      />
                    }
                    style={{
                      data: { fill: "#1E88E5", width: 18 },
                      labels: { fill: "#222", fontSize: 10 },
                    }}
                  />
                </VictoryChart>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-6">
              No results yet.
            </div>
          )}
        </div>
      </div>

      {/* --- Course Graphs --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Registered Voters --- */}
        <div className="bg-white rounded-xl p-4 shadow">
          <h2 className="text-center text-[#791010] font-bold mb-3 text-lg">
            NUMBER OF REGISTERED VOTERS BY COURSE / YEAR LEVEL
          </h2>
          <VictoryChart
            domainPadding={20}
            theme={VictoryTheme.material}
            height={300}
            padding={{ top: 10, bottom: 80, left: 60, right: 30 }}
          >
            <VictoryAxis
              tickFormat={(t) => coursesByName[t] ?? ""}
              style={{
                tickLabels: { fontSize: 9, angle: -30, textAnchor: "end" },
              }}
            />
            <VictoryAxis dependentAxis />

            <VictoryStack
              colorScale={["#1565C0", "#42A5F5", "#90CAF9", "#BBDEFB"]}
            >
              {yearLevels.map((year) => (
                <VictoryBar
                  key={year}
                  data={courses.map((course) => {
                    const entry = courseData.find(
                      (d) => d.course === course && d.year_level === year
                    );
                    return { x: course, y: entry ? entry.voters : 0 };
                  })}
                  labels={({ datum }) => (datum.y > 0 ? datum.y : "")}
                />
              ))}
            </VictoryStack>
          </VictoryChart>
        </div>

        {/* --- Turnout --- */}
        <div className="bg-white rounded-xl p-4 shadow">
          <h2 className="text-center text-[#791010] font-bold mb-3 text-lg">
            VOTER TURNOUT BY COURSE / YEAR LEVEL
          </h2>
          <VictoryChart
            domainPadding={20}
            theme={VictoryTheme.material}
            height={300}
            padding={{ top: 10, bottom: 80, left: 60, right: 30 }}
          >
            <VictoryAxis
              tickFormat={(t) => coursesByName[t] ?? ""}
              style={{
                tickLabels: { fontSize: 9, angle: -30, textAnchor: "end" },
              }}
            />
            <VictoryAxis dependentAxis />

            <VictoryStack
              colorScale={["#2E7D32", "#66BB6A", "#A5D6A7", "#C8E6C9"]}
            >
              {yearLevels.map((year) => (
                <VictoryBar
                  key={year}
                  data={courses.map((course) => {
                    const entry = courseData.find(
                      (d) => d.course === course && d.year_level === year
                    );
                    return { x: course, y: entry ? entry.turnout ?? 0 : 0 };
                  })}
                  labels={({ datum }) => (datum.y > 0 ? datum.y : "")}
                />
              ))}
            </VictoryStack>
          </VictoryChart>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
