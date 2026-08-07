export const interactiveExperiences = [
	{
		slug: "model-stage",
		title: "贝拉姿势编辑器",
		eyebrow: "PMX POSE EDITOR",
		description: "转动视角、调整骨骼和表情，为贝拉摆出你喜欢的姿势。",
		mark: "✧",
		tone: "pink",
		action: "开始编辑",
	},
	{
		slug: "memory-match",
		title: "记忆翻翻乐",
		eyebrow: "MEMORY MATCH",
		description: "翻开卡片，记住图片的位置，找出所有相同的组合。",
		mark: "✦",
		tone: "violet",
	},
	{
		slug: "hair-stop",
		title: "枝江拼装室",
		eyebrow: "CHARACTER ASSEMBLY",
		description:
			"挑选不同角色的身体、服装和配饰，自由组合并调整成新的形象。",
		mark: "⬡",
		tone: "blue",
	},
	{
		slug: "stage-puzzle",
		title: "滑块拼图",
		eyebrow: "SLIDING PUZZLE",
		description: "移动被打乱的方形滑块，一步步恢复完整图片。",
		mark: "▦",
		tone: "gold",
	},
	{
		slug: "jigsaw-puzzle",
		title: "自由拼图",
		eyebrow: "JIGSAW PUZZLE",
		description: "拖动散落的拼图碎片，把完整图片重新拼出来。",
		mark: "◇",
		tone: "pink",
	},
	{
		slug: "link-match",
		title: "图案连连看",
		eyebrow: "LINK MATCH",
		description: "找出两个相同图案，用不超过两次转弯的路线将它们连接。",
		mark: "⌘",
		tone: "violet",
	},
	{
		slug: "pet-pet",
		title: "摸摸贝拉",
		eyebrow: "PETPET GIF MAKER",
		description: "选择贝拉图片或上传自己的图片，生成一张摸头 GIF。",
		mark: "♡",
		tone: "coral",
		action: "制作 GIF",
	},
] as const;

export const visibleInteractiveExperiences = interactiveExperiences.filter(
	(experience) => !("hidden" in experience && experience.hidden),
);
