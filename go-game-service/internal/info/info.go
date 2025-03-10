package info

type NBATeam struct {
	Conference   string  `json:"Conference"`
	GamesBack    string  `json:"GamesBack"` // 使用 string，因为 map 中的值为 interface{}
	Losses       float64 `json:"Losses"`
	Streak       string  `json:"Streak"`
	TeamName     string  `json:"TeamName"`
	WinPct       float64 `json:"WinPct"`
	Wins         float64 `json:"Wins"`
	Abbreviation string  `json:"abbreviation"`
	ID           float64 `json:"id"`
}
