export type TimelineEventLink = {
	label: string;
	url: string;
};

export type TimelineEvent = {
	id: string;
	date: string;
	title: string;
	description: string;
	status?: "upcoming";
	links?: TimelineEventLink[];
};

export const timelineEvents: TimelineEvent[] = [
	{
		id: "reach-10w-followers",
		date: "2021-05-03",
		title: "达成10万粉丝",
		description:
			"",
		links: [],
	},
	{
		id: "first-birthday-live",
		date: "2021-07-16",
		title: "一周年生日会",
		description:
			"《贝拉生日会！一起来哟！》，直播结束时共 11396 位舰长，达成“全 B 站第二个万舰主播”和“虚拟主播中第一个万舰主播”成就。",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1kv411n7bX",
			},
		],
	},
	{
		id: "keep-course",
		date: "2021-09-15",
		title: "Keep上线专属课程",
		description: "《虚拟女团燃脂舞·A-SOUL贝拉》上线。",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/570543283806714548",
			},
		],
	},
	{
		id: "shiny-dancer",
		date: "2021-09-25",
		title: "首支个人单曲《Shiny Dancer》正式发布",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1JM4y137qB",
			},
		],
	},
	{
		id: "decoration-1",
		date: "2021-11-18",
		title: "上线首个B站个性装扮",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/594324878499667093",
			},
		],
	},
	{
		id: "five-hundred-thousand-followers",
		date: "2021-12-25",
		title: "达成50万粉丝",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/608179584009952429",
			},
		],
	},
	{
		id: "dramatic-first-day",
		date: "2022-05-11",
		title: "直播《虚拟主播史上最戏剧的第一天》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1X44y1u7RQ",
			},
		],
	},
	{
		id: "second-birthday-live",
		date: "2022-07-17",
		title: "二周年生日会《和贝拉一起星际旅行》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1Ht4y157Gb",
			},
		],
	},
	{
		id: "decoration-2",
		date: "2022-08-17",
		title: "上线第二个B站个性装扮",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/694902056364802064",
			},
		],
	},
	{
		id: "smile",
		date: "2022-09-30",
		title: "与GSAS联合出品“粘土人 贝拉 A-SOUL“",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://t.bilibili.com/711543787553292291",
			},
		],
	},
	{
		id: "naodongbo",
		date: "2023-05-09",
		title: "上线脑洞波主题个性装扮",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/793303652651499606",
			},
		],
	},
	{
		id: "yinsheng",
		date: "2023-05-22",
		title: "贝拉·初夏伊始主题音声发售",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://t.bilibili.com/798397483875041285",
			},
		],
	},
	{
		id: "shanxin",
		date: "2023-06-21",
		title: "与山新联动直播：《舞担贝拉，来认识新朋友啦！》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1xh411K7ep",
			},
		],
	},
	{
		id: "third-birthday-live",
		date: "2023-07-16",
		title: "三周年生日会《向着星的方向》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1EX4y1Y79E",
			},
		],
	},
	{
		id: "fourth-birthday-live",
		date: "2024-07-20",
		title: "四周年生日会《星之回响》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1TE421w7ae",
			},
		],
	},
	{
		id: "ice-fire-ambassador",
		date: "2024-09-16",
		title: "2024冰火歌会中秋大使",
		description: "A-SOUL受邀成为2024冰火歌会中秋大使，表演《千本樱》。",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/festival/binghuogehuimanyouji?bvid=BV19StseQEAs",
			},
		],
	},
	{
		id: "soul-gaze-single",
		date: "2024-10-12",
		title: "第二首个人单曲《我以灵魂注视你的心》正式上线",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://t.bilibili.com/987273201652334601",
			},
		],
	},
	{
		id: "moon-collab",
		date: "2024-12-18",
		title: "与中国绊爱合作翻唱《若月亮没来》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1gykFYwE7o",
			},
		],
	},
	{
		id: "spring-festival-gala",
		date: "2025-01-22",
		title: "登上网络春晚",
		description: "A-SOUL登上网络春晚舞台，表演《寄明月》。",
		links: [
			{
				label: "观看视频1",
				url: "https://www.bilibili.com/video/BV12hfiYeEYW",
			},
			{
				label: "观看视频2",
				url: "https://www.bilibili.com/video/BV1bBfhYsEbY",
			},
		],
	},
	{
		id: "fifth-birthday-live",
		date: "2025-07-19",
		title: "五周年生日会《绝对禁区》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1sYudz6ECH/",
			},
		],
	},
	{
		id: "time-traveler-collection",
		date: "2025-09-09",
		title: "上线B站收藏集《时空旅人》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1HqYPzJEmJ",
			},
		],
	},
	{
		id: "first-solo-concert",
		date: "2025-09-14",
		title: "首次个人专场演唱会《时墟交错舞台》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1espyzWEYF",
			},
		],
	},
	{
		id: "dance-together-single",
		date: "2025-09-30",
		title: "第三首个人单曲《一起跳起来》正式上线",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/1118265175176118276",
			},
		],
	},
	{
		id: "dance-together-collab",
		date: "2025-12-31",
		title: "与中国绊爱联合投稿《一起跳起来》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1ZRiMB5EjF",
			},
		],
	},
	{
		id: "seven-hundred-thousand-followers",
		date: "2026-04-09",
		title: "达成70万粉丝",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1MkDxB7EQY",
			},
		],
	},
	{
		id: "second-solo-concert",
		date: "2026-04-18",
		title: "第二次个人专场演唱会《在月光下加冕》",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1LCdkBJE3c",
			},
		],
	},
	{
		id: "sixth-birthday-live",
		date: "2026-07-25",
		title: "六周年生日会《八音盒少女》",
		description: "",
		status: "upcoming",
	},
];
