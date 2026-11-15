' 无窗口跑一条命令行 (计划任务用): wscript.exe //B "run_hidden.vbs" "<完整命令行>"
' 计划任务以「用户登录时运行」注册, 直接跑 python.exe / pwsh.exe 会弹黑窗(即使 -WindowStyle Hidden 也会闪一下);
' 经 WScript.Shell.Run 的 windowStyle=0 起, 就一个窗都不弹。Bo 0909「时不时弹一个 bat 的窗口」。
' 等子进程结束并把它的退出码原样返回, 任务计划里的「上次结果」仍是脚本自己的退出码(0 成功 / 2 自验不过)。
' 第一个参数写 -nowait 则不等待直接返回(T261006-37#2): 常驻服务要从 restart_* 脚本里脱手拉起,
' 那些脚本自己还要接着做 /health 自检, 不能被 wscript 等住; 计划任务不带 -nowait, 行为不变。
' 注意不能用 /nowait: WSH 会把 / 开头的参数归进 Arguments.Named, 无名参数列表里根本看不到。
' 命令行以 pwsh.exe 开头时补成 %LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe 全路径: 任务计划的 PATH 不含用户目录,
' 而 schtasks /TR 限 261 字符写不下全路径 (真身 C:\Program Files\WindowsApps\... 在计划任务里起不来, 只能走别名)。
Dim sh, fso, cmd, i, rc, alias, nowait, first
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
nowait = False
first = 0
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "-nowait" Then
    nowait = True
    first = 1
  End If
End If
cmd = ""
For i = first To WScript.Arguments.Count - 1
  If i > first Then cmd = cmd & " "
  cmd = cmd & WScript.Arguments(i)
Next
If LCase(Left(cmd, 8)) = "pwsh.exe" Then
  alias = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\WindowsApps\pwsh.exe"
  If fso.FileExists(alias) Then cmd = """" & alias & """" & Mid(cmd, 9)
End If
rc = 0
If cmd <> "" Then
  On Error Resume Next
  If nowait Then
    ' 不等子进程; sh.Run 失败(127)之外没有退出码可带, 交给调用方自己的健康自检兜底
    sh.Run cmd, 0, False
    If Err.Number <> 0 Then rc = 127
  Else
    rc = sh.Run(cmd, 0, True)
    If Err.Number <> 0 Then rc = 127
  End If
  On Error GoTo 0
End If
WScript.Quit rc
