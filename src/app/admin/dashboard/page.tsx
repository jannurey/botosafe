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

  // --- Predictive Analytics (Fixed to analyze per position) ---
  const voterTurnout: number =
    summary && summary.voters > 0 ? (summary.voted / summary.voters) * 100 : 0;

  let participationPrediction: string = "Awaiting voter data...";
  let participationColor: string = "#9E9E9E";

  if (summary && summary.voters > 0) {
    if (voterTurnout >= 80) {
      participationPrediction = "High Participation";
      participationColor = "#4CAF50"; // green
    } else if (voterTurnout >= 50) {
      participationPrediction = "Moderate Participation";
      participationColor = "#FFB300"; // yellow
    } else if (voterTurnout >= 1) {
      participationPrediction = "Low Participation";
      participationColor = "#D32F2F"; // red
    }
  }

  // Competition prediction - analyze EACH position separately
  const competitionAnalysis: { position: string; prediction: string; color: string }[] = [];
  
  Object.keys(groupedResults).forEach(position => {
    const positionResults = groupedResults[position];
    if (!positionResults || positionResults.length === 0) {
      competitionAnalysis.push({
        position,
        prediction: "No candidates yet",
        color: "#9E9E9E"
      });
      return;
    }

    if (positionResults.length === 1) {
      competitionAnalysis.push({
        position,
        prediction: "Uncontested (1 candidate)",
        color: "#1976D2"
      });
      return;
    }

    const sorted = [...positionResults].sort((a, b) => b.vote_count - a.vote_count);
    const totalVotesInPosition = sorted.reduce((sum, c) => sum + c.vote_count, 0);

    if (totalVotesInPosition === 0) {
      competitionAnalysis.push({
        position,
        prediction: "No votes yet",
        color: "#9E9E9E"
      });
      return;
    }

    const top = sorted[0].vote_count;
    const second = sorted[1]?.vote_count || 0;
    const leadPercent = totalVotesInPosition > 0 ? ((top - second) / totalVotesInPosition) * 100 : 0;

    let prediction = "";
    let color = "";

    if (leadPercent >= 30) {
      prediction = "Clear Leader";
      color = "#4CAF50";
    } else if (leadPercent >= 15) {
      prediction = "Moderate Lead";
      color = "#FFB300";
    } else if (leadPercent >= 5) {
      prediction = "Close Race";
      color = "#FF9800";
    } else {
      prediction = "Tight Competition";
      color = "#D32F2F";
    }

    competitionAnalysis.push({ position, prediction, color });
  });

  // Overall election trend
  let overallTrend = "Awaiting data...";
  if (competitionAnalysis.length > 0) {
    const tightRaces = competitionAnalysis.filter(a => 
      a.prediction.includes("Tight") || a.prediction.includes("Close")
    ).length;
    const clearLeaders = competitionAnalysis.filter(a => a.prediction.includes("Clear")).length;

    if (tightRaces > competitionAnalysis.length / 2) {
      overallTrend = "Highly Competitive Election";
    } else if (clearLeaders > competitionAnalysis.length / 2) {
      overallTrend = "Clear Frontrunners Emerging";
    } else {
      overallTrend = "Mixed Competition Levels";
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {summary?.election && (
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#791010] bg-white rounded-xl p-4 md:p-6 shadow">
          {summary.election.title} <span className="text-gray-600">({summary.election.status.toUpperCase()})</span>
        </h1>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <a 
          href="/admin/voters" 
          className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="text-2xl mb-2">👥</div>
          <div className="text-sm font-semibold">Manage Voters</div>
        </a>
        <a 
          href="/admin/candidates" 
          className="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="text-2xl mb-2">🏆</div>
          <div className="text-sm font-semibold">Manage Candidates</div>
        </a>
        <a 
          href="/admin/elections" 
          className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="text-2xl mb-2">🗳️</div>
          <div className="text-sm font-semibold">Manage Elections</div>
        </a>
        <a 
          href="/admin/settings" 
          className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="text-2xl mb-2">⚙️</div>
          <div className="text-sm font-semibold">Settings</div>
        </a>
      </div>

      {/* --- Voter Stats --- */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "VOTERS", value: summary.voters, color: "#D32F2F", icon: "👥" },
            {
              label: "CANDIDATES",
              value: summary.candidates,
              color: "#1976D2",
              icon: "👤"
            },
            {
              label: "TOTAL WHO VOTED",
              value: summary.voted,
              color: "#388E3C",
              icon: "✅",
              remainder: Math.max(summary.voters - summary.voted, 0),
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white shadow-lg rounded-xl p-4 flex flex-col items-center transition-transform hover:scale-105"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
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
                className="mt-2 text-xl font-bold"
                style={{ color: item.color }}
              >
                {item.value}
              </div>
              <div className="text-sm text-gray-600 font-medium text-center">{item.label}</div>
            </div>
          ))}

          <div className="bg-white shadow-lg rounded-xl p-4 flex flex-col items-center justify-center transition-transform hover:scale-105">
            <div className="text-2xl mb-2">⏰</div>
            {phase === "before" && (
              <>
                <div className="text-sm text-gray-600 font-medium uppercase text-center">
                  Voting not started
                </div>
                <div className="mt-1 font-bold text-[#791010] text-lg text-center">
                  Starts in: {formatTime(timeLeft)}
                </div>
              </>
            )}
            {phase === "ongoing" && (
              <>
                <div className="text-sm text-gray-600 font-medium uppercase text-center">
                  Time remaining
                </div>
                <div className="mt-1 font-bold text-[#791010] text-lg text-center">
                  {formatTime(timeLeft)}
                </div>
              </>
            )}
            {phase === "ended" && (
              <div className="text-lg font-bold text-gray-700 text-center">
                🛑 Voting has ended
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Predictive Analytics Summary --- */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg">
        <h2 className="text-center text-[#791010] font-extrabold text-xl md:text-2xl mb-4 md:mb-6">
          🔮 Predictive Analytics Summary
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Voter Turnout */}
          <div className="p-4 md:p-5 border-2 border-gray-200 rounded-xl hover:border-[#791010] transition-colors">
            <h3 className="text-gray-800 font-bold text-lg mb-3">📈 Voter Turnout</h3>
            <div className="flex flex-col items-center justify-center space-y-3">
              <p
                className="text-3xl md:text-4xl font-extrabold"
                style={{ color: participationColor }}
              >
                {voterTurnout.toFixed(1)}%
              </p>
              <p
                className="text-sm md:text-base font-semibold px-3 py-1 rounded-full text-center"
                style={{ 
                  color: participationColor,
                  backgroundColor: `${participationColor}20`
                }}
              >
                {participationPrediction}
              </p>
              <div className="text-xs text-gray-600 text-center mt-2">
                {summary?.voted || 0} of {summary?.voters || 0} voters
              </div>
            </div>
          </div>

          {/* Overall Trend */}
          <div className="p-4 md:p-5 border-2 border-gray-200 rounded-xl hover:border-[#1976D2] transition-colors">
            <h3 className="text-gray-800 font-bold text-lg mb-3">🏆 Overall Trend</h3>
            <div className="flex items-center justify-center h-full">
              <p className="text-lg md:text-xl font-bold text-[#1976D2] text-center">
                {overallTrend}
              </p>
            </div>
          </div>

          {/* Position Analysis */}
          <div className="p-4 md:p-5 border-2 border-gray-200 rounded-xl hover:border-[#4CAF50] transition-colors md:col-span-2 lg:col-span-1">
            <h3 className="text-gray-800 font-bold text-lg mb-3">🎯 Position Status</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {competitionAnalysis.length > 0 ? (
                competitionAnalysis.slice(0, 5).map((analysis, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium truncate flex-1 mr-2">
                      {analysis.position}
                    </span>
                    <span 
                      className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                      style={{ 
                        color: analysis.color,
                        backgroundColor: `${analysis.color}20`
                      }}
                    >
                      {analysis.prediction}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No position data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Competition Details - Expandable */}
        {competitionAnalysis.length > 5 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-[#791010] font-semibold text-sm hover:underline">
              View all {competitionAnalysis.length} positions
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {competitionAnalysis.slice(5).map((analysis, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                  <span className="text-gray-700 font-medium truncate flex-1 mr-2">
                    {analysis.position}
                  </span>
                  <span 
                    className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                    style={{ 
                      color: analysis.color,
                      backgroundColor: `${analysis.color}20`
                    }}
                  >
                    {analysis.prediction}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* --- Color Legend --- */}
        <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
          <p className="text-center font-semibold text-gray-700 mb-3 md:mb-4">Competition Color Indicators</p>
          <div className="flex flex-wrap justify-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 md:w-3 md:h-3 bg-[#4CAF50] rounded-full"></span>
              <span className="text-xs md:text-sm text-gray-700">Clear Leader</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 md:w-3 md:h-3 bg-[#FFB300] rounded-full"></span>
              <span className="text-xs md:text-sm text-gray-700">Moderate Lead</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 md:w-3 md:h-3 bg-[#FF9800] rounded-full"></span>
              <span className="text-xs md:text-sm text-gray-700">Close Race</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 md:w-3 md:h-3 bg-[#D32F2F] rounded-full"></span>
              <span className="text-xs md:text-sm text-gray-700">Tight</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Results Per Position --- */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg">
        <h1 className="text-center text-[#791010] font-extrabold mb-4 md:mb-6 text-xl md:text-2xl">
          📊 Result Per Position
        </h1>
        <div className="space-y-6 md:space-y-8">
          {Object.keys(groupedResults).length > 0 ? (
            Object.keys(groupedResults).map((position) => (
              <div
                key={position}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 md:p-5 shadow-sm border border-gray-100"
              >
                <h2 className="text-center text-[#791010] font-bold mb-4 text-lg md:text-xl">
                  {position.toUpperCase()}
                </h2>
                <div className="overflow-x-auto">
                  <VictoryChart
                    theme={VictoryTheme.material}
                    domainPadding={16}
                    height={180}
                    padding={{ top: 10, bottom: 50, left: 150, right: 40 }}
                    width={400}
                  >
                    <VictoryAxis
                      dependentAxis
                      style={{
                        axis: { stroke: "transparent" },
                        tickLabels: { fontSize: 10, fill: "#444", fontWeight: "bold" },
                      }}
                    />
                    <VictoryAxis
                      tickValues={voterTicks}
                      tickFormat={(t) => `${t}`}
                      style={{
                        tickLabels: { fontSize: 10, fill: "#444", fontWeight: "bold" },
                      }}
                    />
                    <VictoryBar
                      horizontal
                      cornerRadius={{ topLeft: 4, bottomLeft: 4 }}
                      data={groupedResults[position]}
                      x="candidate_name"
                      y="vote_count"
                      labels={({ datum }) => String(datum.vote_count)}
                      labelComponent={
                        <VictoryTooltip
                          style={{ fontSize: 10, fill: "#333", fontWeight: "bold" }}
                          flyoutStyle={{ fill: "white", stroke: "#ccc" }}
                        />
                      }
                      style={{
                        data: { fill: "#1E88E5", width: 20 },
                        labels: { fill: "#222", fontSize: 10, fontWeight: "bold" },
                      }}
                    />
                  </VictoryChart>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 md:py-12 bg-gray-50 rounded-xl">
              <div className="text-4xl md:text-5xl mb-3">📊</div>
              <p className="text-gray-600 text-base md:text-lg font-medium">No results available yet</p>
              <p className="text-gray-500 mt-1 text-sm md:text-base">Results will appear once voting begins</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Course Graphs --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* --- Registered Voters --- */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg">
          <h2 className="text-center text-[#791010] font-bold mb-4 md:mb-6 text-lg md:text-xl">
            👥 Registered Voters by Course/Year
          </h2>
          <div className="overflow-x-auto">
            <VictoryChart
              domainPadding={20}
              theme={VictoryTheme.material}
              height={300}
              padding={{ top: 20, bottom: 100, left: 70, right: 40 }}
              width={400}
            >
              <VictoryAxis
                tickFormat={(t) => coursesByName[t] ?? ""}
                style={{
                  tickLabels: { fontSize: 8, angle: -45, textAnchor: "end", fill: "#444", fontWeight: "bold" },
                }}
              />
              <VictoryAxis 
                dependentAxis
                style={{
                  tickLabels: { fill: "#444", fontWeight: "bold", fontSize: 8 },
                }}
              />

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
                    labelComponent={
                      <VictoryTooltip
                        style={{ fontSize: 9, fill: "#333", fontWeight: "bold" }}
                        flyoutStyle={{ fill: "white", stroke: "#ccc" }}
                      />
                    }
                    style={{
                      labels: { fill: "#333", fontSize: 9, fontWeight: "bold" },
                    }}
                  />
                ))}
              </VictoryStack>
            </VictoryChart>
          </div>
        </div>

        {/* --- Turnout --- */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg">
          <h2 className="text-center text-[#791010] font-bold mb-4 md:mb-6 text-lg md:text-xl">
            📈 Voter Turnout by Course/Year
          </h2>
          <div className="overflow-x-auto">
            <VictoryChart
              domainPadding={20}
              theme={VictoryTheme.material}
              height={300}
              padding={{ top: 20, bottom: 100, left: 70, right: 40 }}
              width={400}
            >
              <VictoryAxis
                tickFormat={(t) => coursesByName[t] ?? ""}
                style={{
                  tickLabels: { fontSize: 8, angle: -45, textAnchor: "end", fill: "#444", fontWeight: "bold" },
                }}
              />
              <VictoryAxis 
                dependentAxis
                style={{
                  tickLabels: { fill: "#444", fontWeight: "bold", fontSize: 8 },
                }}
              />

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
                    labelComponent={
                      <VictoryTooltip
                        style={{ fontSize: 9, fill: "#333", fontWeight: "bold" }}
                        flyoutStyle={{ fill: "white", stroke: "#ccc" }}
                      />
                    }
                    style={{
                      labels: { fill: "#333", fontSize: 9, fontWeight: "bold" },
                    }}
                  />
                ))}
              </VictoryStack>
            </VictoryChart>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;