using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using System.Security.Cryptography;
using System.Text;
public static class AgentDockDesktop {
 static Process server; static NotifyIcon tray; static string home=AppDomain.CurrentDomain.BaseDirectory; static string url; static StreamWriter log;
 static string Quote(string value){return "\""+value.Replace("\"","\\\"")+"\"";}
 [STAThread] public static void Main(){
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  string key;using(var hash=SHA256.Create()){key=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(home.ToLowerInvariant()))).Replace("-","").Substring(0,20);}
  bool first;using(var mutex=new Mutex(true,"Local\\AgentDockDesktop-"+key,out first)){
   if(!first){try{url=File.ReadAllText(Path.Combine(home,".desktop-url")).Trim();Open();}catch{MessageBox.Show("Agent Dock is already starting. Check the system tray.","Agent Dock");}return;}
   try{
    string node=@"__NODE_PATH__";
    if(!File.Exists(node)||!Directory.Exists(Path.Combine(home,"node_modules","tsx")))throw new Exception("Run npm install once in this folder to prepare Agent Dock.");
    if(!File.Exists(Path.Combine(home,"dist","index.html")))throw new Exception("The interface build is missing. Run npm install again to rebuild it.");
    int port=0;int preferred=3000;try{var previous=new Uri(File.ReadAllText(Path.Combine(home,".desktop-url")).Trim());if(previous.IsLoopback&&previous.Port>=1024)preferred=previous.Port;}catch{}
    for(int index=-1;index<100;index++){int candidate=index<0?preferred:3000+index;try{var listener=new TcpListener(IPAddress.Loopback,candidate);listener.Start();listener.Stop();port=candidate;break;}catch{}}
    if(port==0)throw new Exception("No free local port available for Agent Dock.");url="http://localhost:"+port;
    File.WriteAllText(Path.Combine(home,".desktop-url"),url);
    log=new StreamWriter(Path.Combine(home,"desktop.log"),true);log.AutoFlush=true;
    var start=new ProcessStartInfo(node,"--import tsx "+Quote(Path.Combine(home,"server.ts"))){WorkingDirectory=home,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
    start.EnvironmentVariables["NODE_ENV"]="production";start.EnvironmentVariables["PORT"]=port.ToString();
    server=new Process();server.StartInfo=start;server.OutputDataReceived+=(sender,e)=>Write(e.Data);server.ErrorDataReceived+=(sender,e)=>Write(e.Data);server.Start();server.BeginOutputReadLine();server.BeginErrorReadLine();
    bool ready=false;for(int attempt=0;attempt<150;attempt++){if(server.HasExited)throw new Exception("Agent Dock server stopped. See desktop.log in this folder.");try{var req=(HttpWebRequest)WebRequest.Create(url+"/api/health");req.Timeout=500;using(var response=req.GetResponse()){using(var reader=new StreamReader(response.GetResponseStream())){if(reader.ReadToEnd().Contains("Agent Dock")){ready=true;break;}}}}catch{}Thread.Sleep(200);}
    if(!ready)throw new Exception("Agent Dock did not start in time. See desktop.log.");
    tray=new NotifyIcon();tray.Icon=SystemIcons.Application;tray.Text="Agent Dock — running";tray.Visible=true;
    var menu=new ContextMenuStrip();menu.Items.Add("Open Agent Dock",null,(sender,e)=>Open());menu.Items.Add("Quit Agent Dock",null,(sender,e)=>{Application.Exit();});tray.ContextMenuStrip=menu;tray.DoubleClick+=(sender,e)=>Open();
    Open();Application.Run();
   }catch(Exception error){MessageBox.Show(error.Message,"Agent Dock",MessageBoxButtons.OK,MessageBoxIcon.Error);}finally{
    if(tray!=null){tray.Visible=false;tray.Dispose();}
    try{if(server!=null&&!server.HasExited){var stop=new ProcessStartInfo("taskkill.exe","/PID "+server.Id+" /T /F"){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};using(var process=Process.Start(stop)){process.WaitForExit(5000);}}}catch{}
    if(log!=null)log.Dispose();
   }
  }
 }
 static void Write(string text){if(text==null)return;try{lock(log){log.WriteLine(text);}}catch{}}
 static void Open(){
  if(String.IsNullOrEmpty(url)||!url.StartsWith("http://localhost:"))return;
  string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
  if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");
  if(File.Exists(edge))Process.Start(new ProcessStartInfo(edge,"--app="+url+" --new-window"){UseShellExecute=false});else Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
 }
}
