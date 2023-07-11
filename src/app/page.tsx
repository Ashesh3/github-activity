"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Divider,
  Input,
  Select,
  Space,
  Timeline,
  notification,
  Tooltip,
  Typography,
} from "antd";
import Icon, {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  InfoCircleTwoTone,
  LoadingOutlined,
  QuestionCircleTwoTone,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import Title from "antd/es/typography/Title";
import Paragraph from "antd/es/typography/Paragraph";
import { GithubPRIcon, GithubIssueIcon, GithubAssignIcon } from "./GithubIcons";
import { CheckboxValueType } from "antd/es/checkbox/Group";
import { CheckboxChangeEvent } from "antd/es/checkbox";
import MarkdownPreview from "@uiw/react-markdown-preview";
import TextArea from "antd/es/input/TextArea";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const rangePresets: {
  label: string;
  value: [Dayjs, Dayjs];
}[] = [
  { label: "Last 1 Day", value: [dayjs().add(-1, "d"), dayjs()] },
  { label: "Last 7 Days", value: [dayjs().add(-7, "d"), dayjs()] },
  { label: "Last 14 Days", value: [dayjs().add(-30, "d"), dayjs()] },
  { label: "Last 90 Days", value: [dayjs().add(-90, "d"), dayjs()] },
];

type NotificationType = "success" | "info" | "warning" | "error";

const EOD_TEMPLATE = `**EOD {{DATE}}** @{{ORGANIZATION}}

**How did the day go?**
{{TODAY_ACTIVITIES}}

**What's next?**
{{TOMORROW_ACTIVITIES}}`;

export default function Home() {
  const [api, contextHolder] = notification.useNotification();

  const notify = (type: NotificationType, message: string, description: string) => {
    api[type]({
      message,
      description,
      duration: 3,
    });
  };

  const [usernameField, setUsernameField] = useState({
    value: "",
    error: "",
    state: "empty",
  });

  const [dateField, setDateField] = useState({
    value: {
      startDate: "",
      endDate: "",
    },
    error: "",
  });

  const [orgFilter, setOrgFilter] = useState({
    list: [],
    value: "",
    error: "",
  });

  const [activity, setActivity] = useState({
    prs: [],
    issues_created: [],
    issues_assigned: [],
    merged: [],
    commits: [],
    error: "",
  });

  const includeInEOD = ["Pull Requests Created", "Issues Created", "Issues Assigned", "Commits Made"];
  const CheckboxGroup = Checkbox.Group;
  const [checkedList, setCheckedList] = useState<CheckboxValueType[]>(includeInEOD);
  const [indeterminate, setIndeterminate] = useState(false);
  const [checkAll, setCheckAll] = useState(true);

  const onChange = (list: CheckboxValueType[]) => {
    setCheckedList(list);
    setIndeterminate(!!list.length && list.length < includeInEOD.length);
    setCheckAll(list.length === includeInEOD.length);
  };

  const onCheckAllChange = (e: CheckboxChangeEvent) => {
    setCheckedList(e.target.checked ? includeInEOD : []);
    setIndeterminate(false);
    setCheckAll(e.target.checked);
  };

  const [fetchBtnState, setFetchBtnState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const onRangeChange = (dates: null | (Dayjs | null)[]) => {
    if (dates) {
      if (dates[0]?.isAfter(dates[1])) {
        setDateField({
          ...dateField,
          error: "Start date should be before end date",
        });
        return;
      }
      setDateField({
        ...dateField,
        error: "",
        value: {
          startDate: dates[0]?.toISOString() ?? "",
          endDate: dates[1]?.toISOString() ?? "",
        },
      });
    } else {
      setDateField({
        ...dateField,
        error: "Date range is required",
      });
    }
  };

  const [EODMessage, setEODMessage] = useState("");

  const checkGithubUsername = async () => {
    if (!usernameField.value) {
      setUsernameField({
        ...usernameField,
        error: "",
        state: "empty",
      });
      return;
    }
    setUsernameField({
      ...usernameField,
      state: "checking",
    });
    try {
      const orgQuery = await fetch(`https://api.github.com/users/${usernameField.value}/orgs`);
      const orgRes = await orgQuery.json();
      if (orgRes?.message === "Not Found") {
        setUsernameField({
          ...usernameField,
          error: "Username not found",
          state: "checked",
        });
      } else {
        setOrgFilter({
          value: "",
          list: orgRes.map((org: { login: string }) => ({ login: org.login })),
          error: "",
        });
        setUsernameField({
          ...usernameField,
          error: "",
          state: "checked",
        });
      }
    } catch (error: any) {
      notify("error", "Error", "Something went wrong while fetching your organizations\n" + error.message);
    }
  };

  async function getLinkedPRs(issue_url: string) {
    if (!issue_url) return [];
    const linkedPRQuery = await fetch("/api/linkedprs", {
      method: "POST",
      body: JSON.stringify({
        url: issue_url,
      }),
    });
    const linkedPRRes = await linkedPRQuery.json();
    return linkedPRRes;
  }

  async function fetchGithubStats() {
    if (!usernameField.value) {
      setUsernameField({
        ...usernameField,
        error: "Username is required",
      });
      return;
    }
    if (!dateField.value.startDate || !dateField.value.endDate) {
      setDateField({
        ...dateField,
        error: "Date range is required",
      });
      return;
    }
    if (usernameField.error || dateField.error) {
      setFetchBtnState("error");
      return;
    }

    notify("info", "Fetching", "Fetching your GitHub stats");
    setFetchBtnState("loading");
    let orgFilterQuery = "";
    if (orgFilter.value) {
      orgFilterQuery = `+org:${orgFilter.value}`;
    }
    try {
      const issuesData = await fetch(
        `https://api.github.com/search/issues?q=author:${usernameField.value}+is:issue+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );
      const issuesDataRes = await issuesData.json();

      for (const issue of issuesDataRes.items) {
        issue.type = "issue-created";
      }

      const prData = await fetch(
        `https://api.github.com/search/issues?q=author:${usernameField.value}+is:pr+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );
      const prDataRes = await prData.json();

      for (const pr of prDataRes.items) {
        pr.type = "pr-created";
      }

      const issuesAssignedData = await fetch(
        `https://api.github.com/search/issues?q=assignee:${usernameField.value}+is:issue+created:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );
      const issuesAssignedDataRes = await issuesAssignedData.json();

      for (const issue of issuesAssignedDataRes.items) {
        issue.type = "issue-assigned";
      }

      const assignedIssues: any = [];

      for (const issue of issuesAssignedDataRes.items) {
        const events = await fetch(issue.events_url);
        const eventsRes = await events.json();

        for (const event of eventsRes) {
          if (
            event.event === "assigned" &&
            event.assignee?.login?.toLowerCase() === usernameField.value.toLowerCase()
          ) {
            assignedIssues.push({
              ...issue,
              assigned_at: event.created_at,
              linked_pr: await getLinkedPRs(issue.html_url),
            });
            break;
          }
        }
      }

      const commitsData = await fetch(
        `https://api.github.com/search/commits?q=author:${usernameField.value}+committer-date:${dateField.value.startDate}..${dateField.value.endDate}${orgFilterQuery}&per_page=100`
      );
      const commitsDataRes = await commitsData.json();
      const myCommits = commitsDataRes.items.filter(
        (commit: any) => commit.committer?.login?.toLowerCase() === usernameField.value.toLowerCase()
      );
      const commits: any = [];

      for (const commit of myCommits) {
        const commit_message_lines = commit.commit.message.split("\n");
        commit.type = "commit-created";
        commit.created_at = commit.commit.committer.date;
        commit.title = commit_message_lines[0];
        const linkedPRQuery = await fetch(commit.url + "/pulls");
        const linkedPRRes = await linkedPRQuery.json();
        let isLinkedPRPresent = false;
        for (const linkedPR of linkedPRRes) {
          for (const pr of prDataRes.items) {
            if (linkedPR.node_id === pr.node_id) {
              isLinkedPRPresent = true;
              break;
            }
          }
        }
        if (!isLinkedPRPresent) commits.push(commit);
      }

      const mergedTimeline: any = [...issuesDataRes.items, ...prDataRes.items, ...assignedIssues, ...commits].sort(
        (a: { created_at: string; assigned_at?: string }, b: { created_at: string; assigned_at?: string }) =>
          dayjs(a.assigned_at || a.created_at).isAfter(dayjs(b.assigned_at || b.created_at)) ? -1 : 1
      );

      setActivity({
        prs: prDataRes.items,
        issues_created: issuesDataRes.items,
        issues_assigned: assignedIssues,
        merged: mergedTimeline,
        commits: commits,
        error: "",
      });
      setFetchBtnState("success");
    } catch (error: any) {
      notify("error", "Error", "Something went wrong while fetching your GitHub stats\n" + error.message);
    }
  }

  function getTimelineDot(type: string) {
    switch (type) {
      case "issue-created":
        return (
          <Tooltip title="Issue Created">
            <InfoCircleTwoTone twoToneColor="#52c41a" />
          </Tooltip>
        );
      case "issue-assigned":
        return (
          <Tooltip title="Issue Assigned">
            <Icon component={GithubAssignIcon} />
          </Tooltip>
        );
      case "pr-created":
        return (
          <Tooltip title="Pull Request Created">
            <Icon component={GithubPRIcon} />
          </Tooltip>
        );
      case "commit-created":
        return (
          <Tooltip title="Commit Created">
            <Icon component={GithubIssueIcon} />
          </Tooltip>
        );
      default:
        return (
          <Tooltip title="Unknown Action">
            <QuestionCircleTwoTone twoToneColor="#8c8c8c" />
          </Tooltip>
        );
    }
  }

  function getRepoName(url: string) {
    return url.replace("https://github.com/", "")?.split("/")?.[1] || "";
  }

  function getEODMessage() {
    let eodMessage = EOD_TEMPLATE;
    eodMessage = eodMessage.replace("{{DATE}}", dayjs().format("DD/MM/YYYY"));
    eodMessage = eodMessage.replace("{{ORGANIZATION}}", orgFilter.value);

    let todayActivities: string[] = [];

    if (checkedList.includes("Pull Requests Created")) {
      todayActivities = todayActivities.concat(
        activity.prs.map((pr: any) => {
          return `- Made PR [${getRepoName(pr.html_url)}#${pr.number}](${pr.html_url}): ${pr.title}`;
        })
      );
    }
    if (checkedList.includes("Issues Created")) {
      todayActivities = todayActivities.concat(
        activity.issues_created.map((issue: any) => {
          return `- Created issue [${getRepoName(issue.html_url)}#${issue.number}](${issue.html_url}): ${issue.title}`;
        })
      );
    }
    if (checkedList.includes("Commits Made")) {
      todayActivities = todayActivities.concat(
        activity.commits.map((commit: any) => {
          return `- Comitted [${getRepoName(commit.html_url)}#${commit.sha?.slice(0, 7)}](${commit.html_url}): ${
            commit.title
          }`;
        })
      );
    }

    eodMessage = eodMessage.replace("{{TODAY_ACTIVITIES}}", todayActivities.join("\n"));

    let tomorrowActivities: string[] = [];
    const unfinishedIssues = activity.issues_assigned.filter(
      (issue: any) => !issue.linked_pr?.length && issue.state === "open"
    );
    if (checkedList.includes("Issues Assigned")) {
      tomorrowActivities = tomorrowActivities.concat(
        unfinishedIssues.map((issue: any) => {
          return `- Work on issue [${getRepoName(issue.html_url)}#${issue.number}](${issue.html_url}): ${issue.title}`;
        })
      );
    }

    eodMessage = eodMessage.replace("{{TOMORROW_ACTIVITIES}}", tomorrowActivities.join("\n"));

    return eodMessage;
  }

  return (
    <>
      {contextHolder}
      <div className="py-6">
        <Card className="mx-auto max-w-5xl">
          <Typography>
            <Title level={3} className="text-center">
              Github Activity Report
            </Title>
            <Paragraph className="text-center text-lg">
              This is a simple EOD update generator that will help you to create a summary of your GitHub activity
            </Paragraph>
          </Typography>
          <Space.Compact className="w-full">
            <Input
              autoComplete="off"
              placeholder="GitHub username"
              className="w-1/4"
              value={usernameField.value}
              onChange={(e) => {
                setUsernameField({ ...usernameField, value: e.target.value, error: "" });
              }}
              status={usernameField.error ? "error" : undefined}
              suffix={
                (usernameField.state === "checking" && <LoadingOutlined />) ||
                (usernameField.value &&
                  usernameField.state === "checked" &&
                  (usernameField.error ? (
                    <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                  ) : (
                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                  ))) || <span />
              }
              onBlur={checkGithubUsername}
              onFocus={() => {
                setUsernameField({ ...usernameField, state: "focus" });
              }}
            />
            <Select
              showSearch
              className="w-1/4"
              placeholder="Select an organization"
              optionFilterProp="children"
              onChange={(e) => {
                setOrgFilter({ ...orgFilter, value: e });
              }}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={orgFilter.list.map((org: { login: string }) => ({ label: org.login, value: org.login }))}
              disabled={usernameField.state !== "checked" || orgFilter.list.length === 0}
            />
            <RangePicker
              className="w-1/2"
              presets={rangePresets}
              showTime
              status={dateField.error ? "error" : undefined}
              format="DD/MM/YYYY HH:mm"
              onChange={onRangeChange}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={fetchGithubStats}
              loading={fetchBtnState === "loading"}
            >
              Fetch
            </Button>
          </Space.Compact>
          {(usernameField.error || dateField.error) && (
            <div className="mr-8">
              <Text type="danger" className={`w-1/3 inline-block ${usernameField.error ? "visible" : "invisible"}`}>
                {usernameField.error}
              </Text>
              <Text type="danger" className={`w-1/3 inline-block ${orgFilter.error ? "visible" : "invisible"}`}>
                {orgFilter.error}
              </Text>
              <Text type="danger" className={`w-1/3 inline-block ${dateField.error ? "visible" : "invisible"}`}>
                {dateField.error}
              </Text>
            </div>
          )}
          <Divider />
          {activity.merged.length > 0 && (
            <div className="">
              <ConfigProvider
                theme={{
                  token: {
                    padding: 12,
                  },
                }}
              >
                <Timeline
                  mode="left"
                  reverse
                  items={activity.merged.map((activity: any) => ({
                    label: (
                      <div className="flex justify-between">
                        <a href={activity.html_url} target="_blank" rel="noreferrer" className="italic">
                          {activity.repository_url?.split("/repos/")?.[1] ||
                            activity.repository.full_name ||
                            "-" + activity.type}
                          <span className="font-medium">{"#" + (activity.number || activity.sha?.slice(0, 6))}</span>
                        </a>
                        {"  "}
                        <p>{dayjs(activity.assigned_at || activity.created_at).format("Do MMMM YYYY h:mm A")}</p>
                      </div>
                    ),
                    color: "green",
                    dot: getTimelineDot(activity.type),
                    children: activity.title,
                  }))}
                />
              </ConfigProvider>
            </div>
          )}
          {activity.merged.length > 0 && (
            <>
              <Divider className="my-1" />
              <div className="flex flex-col mb-3">
                <p className="text-md text-gray-500 font-semibold mt-2">Include in EOD</p>
                <div>
                  <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                    |
                  </Checkbox>
                  <CheckboxGroup options={includeInEOD} value={checkedList} onChange={onChange} />
                  <Button
                    type="primary"
                    className="float-right"
                    onClick={() => {
                      setEODMessage(getEODMessage());
                    }}
                  >
                    Generate EOD
                  </Button>
                </div>
              </div>
            </>
          )}
          {EODMessage && (
            <div>
              <TextArea
                value={EODMessage}
                autoSize
                onChange={(e) => {
                  setEODMessage(e.target.value);
                }}
              />
              <div className="my-4"></div>
              <MarkdownPreview
                className="border border-gray-300 rounded-lg p-2"
                source={EODMessage}
                wrapperElement={{
                  "data-color-mode": "light",
                }}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
