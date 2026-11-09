import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Descriptions, Empty, Flex, Form, Input, List, Modal, Row, Space, Steps, Tag, Typography } from "antd";
import { planningApi } from "../../lib/api/planning";
import type { Brief, Series, Strategy } from "../../lib/api/types";

const planningStatusLabel: Record<string, string> = {
  active: "进行中",
  planned: "待生产",
  completed: "已完成",
  archived: "已归档",
};

export function PlanningPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [strategyId, setStrategyId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // 创建表单状态
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [briefTitle, setBriefTitle] = useState("");

  // 详情与编辑状态
  const [detail, setDetail] = useState<Strategy | Series | Brief>();
  const [editing, setEditing] = useState<Strategy | Series | Brief>();
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    planningApi
      .listStrategies()
      .then((result) => {
        if (!active) return;
        setStrategies(result.data);
        if (result.data[0]) setStrategyId(result.data[0].id);
      })
      .catch(() => setNotice("加载内容战略失败"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!strategyId) {
      setSeries([]);
      setSeriesId("");
      return;
    }
    // 切换战略时先清空旧系列与任务，避免请求返回前误操作旧数据。
    setSeries([]);
    setSeriesId("");
    setBriefs([]);
    let active = true;
    planningApi
      .listSeries(strategyId)
      .then((result) => {
        if (!active) return;
        setSeries(result.data);
        setSeriesId(result.data[0]?.id ?? "");
      })
      .catch(() => setNotice("加载内容系列失败"));
    return () => {
      active = false;
    };
  }, [strategyId]);

  useEffect(() => {
    if (!seriesId) {
      setBriefs([]);
      return;
    }
    let active = true;
    planningApi
      .listBriefs(seriesId)
      .then((result) => {
        if (active) setBriefs(result.data);
      })
      .catch(() => setNotice("加载文章任务失败"));
    return () => {
      active = false;
    };
  }, [seriesId]);

  const handleCreateStrategy = () => {
    if (!name.trim() || !goal.trim()) {
      setNotice("请填写战略名称和战略目标");
      return;
    }
    setActionLoading(true);
    planningApi
      .createStrategy({ name: name.trim(), goal: goal.trim(), contentPillars: [], avoidTopics: [] })
      .then((result) => {
        setStrategies((items) => [result.data, ...items]);
        setStrategyId(result.data.id);
        setName("");
        setGoal("");
        setNotice("战略已创建");
      })
      .catch(() => setNotice("创建战略失败"))
      .finally(() => setActionLoading(false));
  };

  const handleCreateSeries = () => {
    if (!strategyId || !seriesName.trim()) return;
    setActionLoading(true);
    planningApi
      .createSeries(strategyId, {
        sequence: series.length + 1,
        name: seriesName.trim(),
        targetCount: 1,
        orderMode: "sequential",
      })
      .then((result) => {
        setSeries((items) => [...items, result.data]);
        setSeriesId(result.data.id);
        setSeriesName("");
        setNotice("系列已创建");
      })
      .catch(() => setNotice("创建系列失败"))
      .finally(() => setActionLoading(false));
  };

  const handleCreateBrief = () => {
    if (!seriesId || !briefTitle.trim()) return;
    setActionLoading(true);
    planningApi
      .createBrief(seriesId, {
        sequence: briefs.length + 1,
        titleDirection: briefTitle.trim(),
        mustCover: [],
        mustAvoid: [],
      })
      .then((result) => {
        setBriefs((items) => [...items, result.data]);
        setBriefTitle("");
        setNotice("文章任务已创建");
      })
      .catch(() => setNotice("创建任务失败"))
      .finally(() => setActionLoading(false));
  };

  const startEdit = (item: Strategy | Series | Brief) => {
    setEditing(item);
    if ("goal" in item) {
      setEditName(item.name);
      setEditGoal(item.goal);
    } else if ("targetCount" in item) {
      setEditName(item.name);
    } else {
      setEditTitle(item.titleDirection);
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    if ("goal" in editing && (!editName.trim() || !editGoal.trim())) {
      setNotice("战略名称和战略目标不能为空");
      return;
    }
    if ("targetCount" in editing && !editName.trim()) {
      setNotice("系列名称不能为空");
      return;
    }
    if ("titleDirection" in editing && !editTitle.trim()) {
      setNotice("标题方向不能为空");
      return;
    }
    setActionLoading(true);
    const request =
      "goal" in editing
        ? planningApi.updateStrategy(editing.id, { name: editName.trim(), goal: editGoal.trim() })
        : "targetCount" in editing
          ? planningApi.updateSeries(editing.id, { name: editName.trim() })
          : planningApi.updateBrief(editing.id, { titleDirection: editTitle.trim() });

    request
      .then(() => {
        setEditing(undefined);
        setNotice("内容已更新");
        if ("goal" in editing) return planningApi.listStrategies().then((result) => setStrategies(result.data));
        if ("targetCount" in editing && strategyId) return planningApi.listSeries(strategyId).then((result) => setSeries(result.data));
        if (seriesId) return planningApi.listBriefs(seriesId).then((result) => setBriefs(result.data));
      })
      .catch(() => setNotice("更新失败"))
      .finally(() => setActionLoading(false));
  };

  const currentStep = seriesId ? 2 : strategyId ? 1 : 0;
  const currentStrategy = strategies.find((s) => s.id === strategyId);
  const currentSeries = series.find((s) => s.id === seriesId);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle">
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            CONTENT PLANNING
          </Typography.Text>
          <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
            内容规划
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            按“战略 ➔ 系列 ➔ 文章任务”逐级推进内容生产，三级联动掌控全局。
          </Typography.Paragraph>
        </div>
      </Flex>

      <Card size="small">
        <Steps
          current={currentStep}
          items={[
            {
              title: "1. 内容战略",
              description: currentStrategy ? currentStrategy.name : "定义核心方向",
            },
            {
              title: "2. 内容系列",
              description: currentSeries ? currentSeries.name : strategyId ? "选择或创建系列" : "等待战略",
            },
            {
              title: "3. 文章任务",
              description: briefs.length > 0 ? `${briefs.length} 个任务待生产` : seriesId ? "创建文章任务" : "等待系列",
            },
          ]}
        />
      </Card>

      {notice && <Alert type="info" showIcon message={notice} closable onClose={() => setNotice("")} />}

      <Row gutter={[16, 16]}>
        {/* 第一列：内容战略 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Flex justify="space-between" align="center">
                <span>1. 内容战略</span>
                <Tag color={strategyId ? "blue" : "default"}>{strategies.length} 个战略</Tag>
              </Flex>
            }
            style={{ height: "100%" }}
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, border: "1px solid #f0f0f0" }}>
                <Space.Compact block style={{ marginBottom: 8 }}>
                  <Input
                    placeholder="新建战略名称…"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onPressEnter={handleCreateStrategy}
                  />
                  <Button type="primary" disabled={!name.trim() || !goal.trim()} onClick={handleCreateStrategy} loading={actionLoading}>
                    新建
                  </Button>
                </Space.Compact>
                <Input.TextArea
                  rows={2}
                  placeholder="战略目标说明"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                />
              </div>

              <List
                bordered
                size="small"
                loading={loading}
                dataSource={strategies}
                locale={{ emptyText: <Empty description="暂无内容战略，先新建一个吧" /> }}
                renderItem={(item) => {
                  const isSelected = strategyId === item.id;
                  return (
                    <List.Item
                      onClick={() => setStrategyId(item.id)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "#e6f4ff" : "#fff",
                        borderColor: isSelected ? "#91caff" : undefined,
                        borderRadius: 6,
                        marginBottom: 6,
                        transition: "all 0.2s",
                      }}
                      actions={[
                        <Button
                          key="detail"
                          size="small"
                          type="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(item);
                          }}
                        >
                          详情
                        </Button>,
                        <Button
                          key="edit"
                          size="small"
                          type="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(item);
                          }}
                        >
                          编辑
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Typography.Text strong style={{ color: isSelected ? "#1677ff" : undefined }}>
                              {item.name}
                            </Typography.Text>
                            {isSelected && <Tag color="blue">当前选中</Tag>}
                          </Space>
                        }
                        description={
                          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12 }}>
                            {item.goal || "未填写战略目标"}
                          </Typography.Paragraph>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Space>
          </Card>
        </Col>

        {/* 第二列：内容系列 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Flex justify="space-between" align="center">
                <span>2. 内容系列</span>
                <Tag color={seriesId ? "blue" : "default"}>{series.length} 个系列</Tag>
              </Flex>
            }
            style={{ height: "100%" }}
          >
            {strategyId ? (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, border: "1px solid #f0f0f0" }}>
                  <Space.Compact block>
                    <Input
                      placeholder="新建系列名称…"
                      value={seriesName}
                      onChange={(event) => setSeriesName(event.target.value)}
                      onPressEnter={handleCreateSeries}
                    />
                    <Button
                      type="primary"
                      disabled={!seriesName.trim()}
                      onClick={handleCreateSeries}
                      loading={actionLoading}
                    >
                      新建
                    </Button>
                  </Space.Compact>
                </div>

                <List
                  bordered
                  size="small"
                  dataSource={series}
                  locale={{ emptyText: <Empty description="当前战略下暂无系列" /> }}
                  renderItem={(item) => {
                    const isSelected = seriesId === item.id;
                    return (
                      <List.Item
                        onClick={() => setSeriesId(item.id)}
                        style={{
                          cursor: "pointer",
                          background: isSelected ? "#e6f4ff" : "#fff",
                          borderColor: isSelected ? "#91caff" : undefined,
                          borderRadius: 6,
                          marginBottom: 6,
                          transition: "all 0.2s",
                        }}
                        actions={[
                          <Button
                            key="detail"
                            size="small"
                            type="text"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(item);
                            }}
                          >
                            详情
                          </Button>,
                          <Button
                            key="edit"
                            size="small"
                            type="text"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(item);
                            }}
                          >
                            编辑
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <Typography.Text strong style={{ color: isSelected ? "#1677ff" : undefined }}>
                                #{item.sequence} {item.name}
                              </Typography.Text>
                              {isSelected && <Tag color="blue">当前选中</Tag>}
                            </Space>
                          }
                          description={
                            <Space split={<span style={{ color: "#d9d9d9" }}>·</span>} style={{ fontSize: 12 }}>
                              <span>目标 {item.targetCount} 篇</span>
                              <Tag color={item.status === "active" ? "green" : "default"}>{planningStatusLabel[item.status] ?? item.status}</Tag>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </Space>
            ) : (
              <Empty description="请先在左侧选择一个内容战略" />
            )}
          </Card>
        </Col>

        {/* 第三列：文章任务 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Flex justify="space-between" align="center">
                <span>3. 文章任务</span>
                <Tag color={briefs.length ? "blue" : "default"}>{briefs.length} 个任务</Tag>
              </Flex>
            }
            style={{ height: "100%" }}
          >
            {seriesId ? (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, border: "1px solid #f0f0f0" }}>
                  <Space.Compact block>
                    <Input
                      placeholder="新建文章标题方向…"
                      value={briefTitle}
                      onChange={(event) => setBriefTitle(event.target.value)}
                      onPressEnter={handleCreateBrief}
                    />
                    <Button
                      type="primary"
                      disabled={!briefTitle.trim()}
                      onClick={handleCreateBrief}
                      loading={actionLoading}
                    >
                      新建
                    </Button>
                  </Space.Compact>
                </div>

                <List
                  bordered
                  size="small"
                  dataSource={briefs}
                  locale={{ emptyText: <Empty description="当前系列下暂无文章任务" /> }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ borderRadius: 6, marginBottom: 6, background: "#fff" }}
                      actions={[
                        <Button key="detail" size="small" type="text" onClick={() => setDetail(item)}>
                          详情
                        </Button>,
                        <Button key="edit" size="small" type="text" onClick={() => startEdit(item)}>
                          编辑
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Typography.Text strong style={{ fontSize: 13 }}>
                            #{item.sequence} {item.titleDirection}
                          </Typography.Text>
                        }
                        description={
                          <Space size="small" style={{ marginTop: 4 }}>
                            <Tag color="cyan">{planningStatusLabel[item.status] ?? item.status}</Tag>
                            {item.mustCover?.length > 0 && <Tag>{item.mustCover.length} 个要点</Tag>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Space>
            ) : (
              <Empty description="请先在中间列选择一个内容系列" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 详情 Modal */}
      <Modal
        title="内容规划详情"
        open={Boolean(detail)}
        onCancel={() => setDetail(undefined)}
        footer={
          <Button type="primary" onClick={() => setDetail(undefined)}>
            关闭
          </Button>
        }
      >
        {detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="类型">
              {"goal" in detail ? "内容战略 (Strategy)" : "targetCount" in detail ? "内容系列 (Series)" : "文章任务 (Brief)"}
            </Descriptions.Item>
            <Descriptions.Item label="名称/标题">
              {"name" in detail ? detail.name : detail.titleDirection}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color="blue">{planningStatusLabel[detail.status] ?? detail.status}</Tag>
            </Descriptions.Item>
            {"goal" in detail && (
              <>
                <Descriptions.Item label="战略目标">{detail.goal || "未设置"}</Descriptions.Item>
                {detail.contentPillars?.length > 0 && (
                  <Descriptions.Item label="内容支柱">
                    <Space wrap>
                      {detail.contentPillars.map((p) => (
                        <Tag key={p}>{p}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
              </>
            )}
            {"targetCount" in detail && (
              <>
                <Descriptions.Item label="序号">第 {detail.sequence} 个系列</Descriptions.Item>
                <Descriptions.Item label="目标篇数">{detail.targetCount} 篇</Descriptions.Item>
                <Descriptions.Item label="所属战略 ID">{detail.strategyId}</Descriptions.Item>
              </>
            )}
            {"titleDirection" in detail && (
              <>
                <Descriptions.Item label="任务序号">第 {detail.sequence} 篇</Descriptions.Item>
                <Descriptions.Item label="所属系列 ID">{detail.seriesId}</Descriptions.Item>
                {detail.mustCover?.length > 0 && (
                  <Descriptions.Item label="必须覆盖要点">
                    <ul>
                      {detail.mustCover.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </Descriptions.Item>
                )}
                {detail.mustAvoid?.length > 0 && (
                  <Descriptions.Item label="必须规避要点">
                    <ul>
                      {detail.mustAvoid.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Descriptions.Item>
                )}
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 编辑 Modal */}
      <Modal
        title="编辑规划内容"
        open={Boolean(editing)}
        onCancel={() => setEditing(undefined)}
        onOk={saveEdit}
        confirmLoading={actionLoading}
        okText="保存"
        cancelText="取消"
      >
        {editing && (
          <Space direction="vertical" style={{ width: "100%", marginTop: 8 }} orientation="vertical" size="middle">
            {"goal" in editing ? (
              <>
                <Form.Item label="战略名称" required style={{ marginBottom: 8 }}>
                  <Input placeholder="战略名称" value={editName} onChange={(event) => setEditName(event.target.value)} />
                </Form.Item>
                <Form.Item label="战略目标" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="战略目标" value={editGoal} onChange={(event) => setEditGoal(event.target.value)} />
                </Form.Item>
              </>
            ) : "targetCount" in editing ? (
              <Form.Item label="系列名称" required style={{ marginBottom: 0 }}>
                <Input placeholder="系列名称" value={editName} onChange={(event) => setEditName(event.target.value)} />
              </Form.Item>
            ) : (
              <Form.Item label="标题方向" required style={{ marginBottom: 0 }}>
                <Input placeholder="标题方向" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
              </Form.Item>
            )}
          </Space>
        )}
      </Modal>
    </Space>
  );
}
