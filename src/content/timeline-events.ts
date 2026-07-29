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
		id: "account-start",
		date: "2020-11-26",
		title: "创建B站账号",
		description: "",
		links: [],
	},
	{
		id: "first-solo-live",
		date: "2020-12-24",
		title: "在平安夜完成首次个人直播",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/470819859798080665",
			},
		],
	},
	{
		id: "beijixing_name",
		date: "2021-01-06",
		title: "粉丝名确定为“贝极星“",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/477130631333310169",
			},
		],
	},
	{
		id: "introduction",
		date: "2021-02-10",
		title: "首个个人视频发布【自我介绍】简 简 单 单 跳 个 芭 蕾！",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1ry4y1Y71t",
			},
		],
	},
	{
		id: "first-offline-live",
		date: "2021-05-01",
		title: "A-SOUL首次线下Live",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/519834434600202903",
			},
		],
	},
	{
		id: "reach-10w-followers",
		date: "2021-05-03",
		title: "达成10万粉丝",
		description: "",
		links: [],
	},
	{
		id: "first-birthday-live",
		date: "2021-07-16",
		title: "一周年生日会",
		description:
			"《贝拉生日会！一起来哟！》，达成“全 B 站第二个万舰主播”和“虚拟主播中第一个万舰主播”成就。",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1kv411n7bX",
			},
		],
	},
	{
		id: "keep-green",
		date: "2021-08-14",
		title: "Keep联动课程【绿野仙踪·A-SOUL贝拉定制语音版】课程上线",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/558758859912566116",
			},
		],
	},
	{
		id: "lifeafter-collab",
		date: "2021-08-20",
		title: "《明日之后》联动直播",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/556925634731770281",
			},
		],
	},
	{
		id: "keep-course",
		date: "2021-09-15",
		title: "Keep联动课程【虚拟女团燃脂舞·A-SOUL贝拉】课程上线",
		description: "",
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
	// {
	// 	id: "loreal-collab",
	// 	date: "2021-11-05",
	// 	title: "欧莱雅男士联动直播",
	// 	description: "欧莱雅男士联动直播带来新歌、新舞及联动单曲《魂然天成》。",
	// 	links: [
	// 		{
	// 			label: "查看动态",
	// 			url: "https://www.bilibili.com/opus/589476539033638006",
	// 		},
	// 		{
	// 			label: "观看视频",
	// 			url: "https://www.bilibili.com/video/BV1Ar4y1C77P",
	// 		},
	// 	],
	// },
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
	// {
	// 	id: "ssjj2-nvidia-collab",
	// 	date: "2023-01-17",
	// 	title: "1. A-SOUL X《生死狙击2》联动版本上线; 2. NVIDIA X A-SOUL跨次元新春祝福",
	// 	description: "",
	// 	links: [
	// 		{
	// 			label: "查看动态",
	// 			url: "https://www.bilibili.com/opus/749406767552659456",
	// 		},
	// 		{
	// 			label: "观看视频",
	// 			url: "https://www.bilibili.com/video/BV1a14y1M7TZ",
	// 		},
	// 	],
	// },
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
	// {
	// 	id: "leap-top",
	// 	date: "2023-05-11",
	// 	title: "心跳狂飙、疾速领跑！零跑汽车×A-SOUL合作曲《Leap Top》",
	// 	description: "",
	// 	links: [
	// 		{
	// 			label: "观看视频",
	// 			url: "https://www.bilibili.com/video/BV16k4y1j79k",
	// 		},
	// 	],
	// },
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
	// {
	// 	id: "intel-collab",
	// 	date: "2023-07-10",
	// 	title: "英特尔 x A-SOUL惊喜联动",
	// 	description: "",
	// 	links: [
	// 		{
	// 			label: "观看视频",
	// 			url: "https://www.bilibili.com/video/BV11F411X7p8",
	// 		},
	// 	],
	// },
	{
		id: "bilibili-up-emoji",
		date: "2023-07-15",
		title: "贝拉UP主大表情上架",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/818058619830403156",
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
		id: "amap-navigation-voice",
		date: "2024-12-31",
		title: "贝拉主题导航套装在高德地图APP正式上线",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/1016773379949068306",
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
		id: "endfield-collab-streams",
		date: "2026-01-22",
		title: "首次《明日方舟：终末地》商单直播",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1XnzsBpEsj",
			},
		],
	},
	{
		id: "punishing-gray-raven-collab-streams",
		date: "2026-03-17",
		title: "首次《战双帕弥什》商单直播",
		description: "",
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1GqwRzeEiU",
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
		description: `（万舰达成）
［贝拉kira］下播了
标题：【贝拉生日会】八音盒少女
时长：3h27m54s｜大小：10.42 GB
互动人数：17.7k｜弹幕：195.4k
新增舰长：9691 ｜ 提督：230 ｜ 总督：31
SC数量 ： 845｜ 金额：¥72772
总营收：¥2780338
时间：2026-07-25 23:14:42`,
		links: [
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1S23G6UEW2",
			},
			{
				label: "观看视频",
				url: "https://www.bilibili.com/video/BV1AB3F6qE5H",
			},
		],
	},
	{
		id: "xia-zhong-jing-hong",
		date: "2026-07-29",
		title: "收藏集《贝拉的冒险DLC-匣中惊鸿》发售",
		description: "",
		links: [
			{
				label: "查看动态",
				url: "https://www.bilibili.com/opus/1230070045807214598",
			},
		],
	},
];
